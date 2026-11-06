import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Chat Widget",
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
