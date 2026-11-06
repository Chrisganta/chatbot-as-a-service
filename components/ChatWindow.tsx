"use client";

import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ChatWindow({ compact }: { compact?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [context, setContext] = useState<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Load conversation from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("cas-conversation");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {}
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

  return (
    <div
      className={`flex flex-col h-screen bg-white ${
        compact ? "max-w-sm mx-auto" : ""
      }`}
    >
      {!compact && (
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Chat</h1>
          <button
            onClick={handleNewChat}
            className="bg-white text-blue-600 px-3 py-1 rounded hover:bg-gray-100"
          >
            New chat
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            Start a conversation
          </div>
        )}
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} role={msg.role} content={msg.content} />
        ))}
        {isStreaming && (
          <div className="text-gray-500 text-sm">
            <span className="animate-pulse">●</span> Generating...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4 bg-gray-50">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            className="flex-1 border rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={send}
              disabled={isStreaming || !input.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              Send
            </button>
            {isStreaming && (
              <button
                onClick={handleStop}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
