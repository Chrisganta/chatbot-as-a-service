import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat Widget",
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
