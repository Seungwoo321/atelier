import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "Atelier — virtual company of role-specialized agents",
    template: "%s · Atelier",
  },
  description:
    "A Python framework that orchestrates 28 LLM-driven roles across 9 departments through 5 strategic gates.",
  applicationName: "Atelier",
  keywords: ["LLM", "agents", "Claude", "Next.js", "PixiJS", "Pydantic", "LangGraph"],
  authors: [{ name: "Seungwoo Lee" }],
  openGraph: {
    title: "Atelier — virtual company of role-specialized agents",
    description:
      "Drop a request. Watch 28 roles across 9 departments collaborate through 5 strategic gates. Ship typed artifacts on every run.",
    type: "website",
    siteName: "Atelier",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atelier — virtual company of role-specialized agents",
    description:
      "Drop a request. Watch 28 roles across 9 departments collaborate through 5 strategic gates.",
  },
  robots: { index: true, follow: true },
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
