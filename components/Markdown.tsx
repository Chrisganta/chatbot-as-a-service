"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ inline, children, ...props }: any) {
          if (inline) {
            return <code className="bg-gray-200 px-1 rounded" {...props}>{children}</code>;
          }
          return (
            <pre className="bg-gray-800 text-white p-3 rounded overflow-x-auto my-2">
              <code {...props}>{children}</code>
            </pre>
          );
        },
        a: (props: any) => (
          <a {...props} className="text-blue-600 underline" />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
