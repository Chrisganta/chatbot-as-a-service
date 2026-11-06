"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./Markdown.module.css";

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ inline, children, ...props }: any) {
          if (inline) {
            return (
              <code className={styles.inlineCode} {...props}>
                {children}
              </code>
            );
          }
          return (
            <pre className={styles.codeBlock}>
              <code {...props}>{children}</code>
            </pre>
          );
        },
        a: (props: any) => (
          <a {...props} className={styles.link} target="_blank" rel="noopener noreferrer" />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
