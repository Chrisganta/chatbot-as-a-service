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
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When embedded via widget.js inside an iframe, the host page may post
  // grounding context fetched from its own data-context-url endpoint. This
  // is a no-op when not embedded (no parent frame will ever send it).
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (window.parent === window || e.source !== window.parent) return;
      if (e.data?.type === "chatbot-context") {
        setContext(e.data.context ?? undefined);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Load conversation + theme preference from localStorage on mount. Theme
  // starts as null (follow OS prefers-color-scheme) to avoid a server/client
  // render mismatch, then switches to an explicit value after this effect
  // runs client-side only.
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
  }, []);

  // Save conversation to localStorage whenever messages change
  useEffect(() => {
    localStorage.setItem("cas-conversation", JSON.stringify(messages));
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize the textarea as the user types, capped at MAX_TEXTAREA_HEIGHT
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  const send = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
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
            <button
              type="button"
              onClick={handleNewChat}
              className={styles.iconButton}
              aria-label="Start new chat"
              title="New chat"
            >
              <NewChatIcon />
            </button>
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

      <div className={styles.messages}>
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
        <div ref={messagesEndRef} />
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
    </div>
  );
}
