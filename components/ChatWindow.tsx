"use client";

import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import {
  SendIcon,
  StopIcon,
  NewChatIcon,
  EmptyChatIcon,
  SunIcon,
  MoonIcon,
  LockIcon,
} from "./icons";
import styles from "./ChatWindow.module.css";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_TEXTAREA_HEIGHT = 160;

export function ChatWindow({ compact }: { compact?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [context, setContext] = useState<string | undefined>(undefined);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  // Access-code gate. requiresAccessCode is null while /api/health hasn't
  // responded yet; accessCode is the code used as the Bearer token on every
  // /api/chat call once known (from a saved gate submission, or supplied
  // transparently by a trusted embedding host via widget.js's
  // data-access-code attribute).
  const [requiresAccessCode, setRequiresAccessCode] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  // Short-lived token from a host's data-session-url (see widget.js). Takes
  // priority over accessCode when both are present, and is never persisted
  // to localStorage — it's meant to expire and get refreshed by the host.
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When embedded via widget.js inside an iframe, the host page may post
  // grounding context fetched from its own data-context-url endpoint, and/or
  // a pre-assigned access code for trusted sites (bypassing the gate below
  // entirely). This is a no-op when not embedded (no parent frame will ever
  // send it).
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (window.parent === window || e.source !== window.parent) return;
      if (e.data?.type === "chatbot-context") {
        setContext(e.data.context ?? undefined);
        if (e.data.accessCode) setAccessCode(e.data.accessCode);
        setSessionToken(e.data.sessionToken ?? null);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Check whether the gate is even enabled on this deployment.
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setRequiresAccessCode(Boolean(data.requiresAccessCode)))
      .catch(() => setRequiresAccessCode(false));
  }, []);

  // Load conversation + theme + previously-verified access code from
  // localStorage on mount. Theme starts as null (follow OS
  // prefers-color-scheme) to avoid a server/client render mismatch, then
  // switches to an explicit value after this effect runs client-side only.
  useEffect(() => {
    const saved = localStorage.getItem("cas-conversation");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {}
    }
    const savedTheme = localStorage.getItem("cas-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
    const savedCode = localStorage.getItem("cas-access-code");
    if (savedCode) setAccessCode(savedCode);
  }, []);

  // Save conversation to localStorage whenever messages change
  useEffect(() => {
    localStorage.setItem("cas-conversation", JSON.stringify(messages));
  }, [messages]);

  // Scroll the message list itself — never scrollIntoView, which walks
  // ancestor overflow (including the card's overflow: hidden) and parks
  // the composer in the middle of the frame with empty space below it.
  // Instant (not smooth) while streaming so per-token updates don't
  // interrupt an in-flight animation.
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [messages, isStreaming]);

  // Auto-resize the textarea as the user types, capped at MAX_TEXTAREA_HEIGHT
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  const submitAccessCode = async () => {
    const code = codeInput.trim();
    if (!code || verifying) return;
    setVerifying(true);
    setGateError(null);
    try {
      const res = await fetch("/api/verify-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.valid) {
        setAccessCode(code);
        localStorage.setItem("cas-access-code", code);
        setCodeInput("");
      } else {
        setGateError("Invalid code — please try again.");
      }
    } catch {
      setGateError("Couldn't verify the code. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const send = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const bearer = sessionToken || accessCode;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 401) {
          if (sessionToken) {
            // Expired, not revoked — ask the host (widget.js) for a fresh
            // one instead of showing the static-code gate, which an embed
            // user has no code to fill in.
            setSessionToken(null);
            if (window.parent !== window) {
              window.parent.postMessage({ type: "chatbot-session-expired" }, "*");
            }
          } else {
            // The code was revoked or never valid — clear it and show the
            // gate again instead of leaving the user stuck on silent errors.
            setAccessCode(null);
            localStorage.removeItem("cas-access-code");
          }
          setMessages((prev) => prev.slice(0, -1));
          setIsStreaming(false);
          return;
        }
        const error = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${error.error || "Unknown error"}`,
          },
        ]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let assistantMessage = "";

      // Add empty assistant message
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        assistantMessage += text;

        // Update the last message (assistant)
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[updated.length - 1]?.role === "assistant") {
            updated[updated.length - 1].content = assistantMessage;
          }
          return updated;
        });
      }

      setIsStreaming(false);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Failed to get response. Please try again.",
          },
        ]);
      }
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleGateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitAccessCode();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    localStorage.removeItem("cas-conversation");
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  const toggleTheme = () => {
    // theme starts as null (follow OS); first toggle picks the opposite of
    // whatever the OS preference currently renders as light by default.
    const next = theme === "dark" ? "light" : theme === "light" ? "dark" : "dark";
    setTheme(next);
    localStorage.setItem("cas-theme", next);
  };

  const themeToggleLabel =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const ThemeIcon = theme === "dark" ? SunIcon : MoonIcon;

  // Don't flash the open chat UI while we don't yet know if a code is
  // required (and don't already have one saved that would make it moot).
  const checkingGate = requiresAccessCode === null && !accessCode && !sessionToken;
  const gateOpen = requiresAccessCode === true && !accessCode && !sessionToken;

  return (
    <div
      className={`${styles.chat} ${compact ? styles.compact : ""}`}
      data-theme={theme ?? undefined}
    >
      {!compact && (
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>Chat</h1>
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={toggleTheme}
              className={styles.iconButton}
              aria-label={themeToggleLabel}
              title={themeToggleLabel}
            >
              <ThemeIcon />
            </button>
            {!gateOpen && !checkingGate && (
              <button
                type="button"
                onClick={handleNewChat}
                className={styles.iconButton}
                aria-label="Start new chat"
                title="New chat"
              >
                <NewChatIcon />
              </button>
            )}
          </div>
        </header>
      )}

      {compact && (
        <button
          type="button"
          onClick={toggleTheme}
          className={styles.floatingThemeButton}
          aria-label={themeToggleLabel}
          title={themeToggleLabel}
        >
          <ThemeIcon />
        </button>
      )}

      {checkingGate ? (
        <div className={styles.messages} />
      ) : gateOpen ? (
        <div className={styles.gate}>
          <LockIcon />
          <p className={styles.gateTitle}>Enter access code</p>
          <p className={styles.gateSubtitle}>This chat requires a code to unlock.</p>
          <div className={styles.gateForm}>
            <input
              type="password"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={handleGateKeyDown}
              placeholder="Access code"
              className={styles.gateInput}
              disabled={verifying}
              autoFocus
            />
            <button
              type="button"
              onClick={submitAccessCode}
              disabled={verifying || !codeInput.trim()}
              className={styles.gateButton}
            >
              {verifying ? "Checking…" : "Unlock"}
            </button>
          </div>
          {gateError && <p className={styles.gateError}>{gateError}</p>}
        </div>
      ) : (
        <>
          <div className={styles.messages} ref={messagesContainerRef}>
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                <EmptyChatIcon />
                <p>Ask me anything to get started</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} role={msg.role} content={msg.content} />
            ))}
            {isStreaming && (
              <div className={styles.typingIndicator} aria-live="polite">
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.srOnly}>Generating response…</span>
              </div>
            )}
          </div>

          <div className={styles.inputArea}>
            <div className={styles.inputRow}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                className={styles.textarea}
                rows={1}
              />
              <button
                type="button"
                onClick={isStreaming ? handleStop : send}
                disabled={!isStreaming && !input.trim()}
                className={`${styles.sendButton} ${isStreaming ? styles.stopButton : ""}`}
                aria-label={isStreaming ? "Stop generating" : "Send message"}
              >
                {isStreaming ? <StopIcon /> : <SendIcon />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
