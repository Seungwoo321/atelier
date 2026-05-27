"use client";

import { useState } from "react";

export function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          setCopied(false);
        }
      }}
      className={
        "rounded border px-2 py-1 text-[11px] font-mono transition " +
        (copied
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white")
      }
      aria-label={copied ? "copied" : `copy ${label}`}
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}
