"use client";

import { Markdown } from "./Markdown";

export function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`max-w-xs px-4 py-2 rounded-lg ${
          isUser
            ? "bg-blue-500 text-white rounded-br-none"
            : "bg-gray-200 text-gray-900 rounded-bl-none"
        }`}
      >
        {isUser ? (
          <p>{content}</p>
        ) : (
          <div className="text-sm">
            <Markdown>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
