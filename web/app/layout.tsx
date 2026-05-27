import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atelier — virtual company of role-specialized agents",
  description:
    "A Python framework that orchestrates 28 LLM-driven roles across 9 departments through 5 strategic gates.",
};

export default function RootLayout({
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
