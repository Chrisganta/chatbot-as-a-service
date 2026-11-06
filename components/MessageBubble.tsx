"use client";

import { Markdown } from "./Markdown";
import styles from "./MessageBubble.module.css";

export function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`${styles.row} ${isUser ? styles.rowUser : styles.rowAssistant}`}>
      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAssistant}`}>
        {isUser ? (
          <p className={styles.text}>{content}</p>
        ) : (
          <div className={styles.markdownWrapper}>
            <Markdown>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
