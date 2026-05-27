"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [tick, setTick] = useState(0);
  const lastRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      lastRef.current = Date.now();
      setTick((t) => t + 1);
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [enabled]);

  const since = Math.max(0, Date.now() - lastRef.current);
  const remaining = Math.max(0, intervalMs - since);
  const sec = (remaining / 1000).toFixed(1);

  return (
    <button
      type="button"
      onClick={() => setEnabled((v) => !v)}
      className={
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono transition " +
        (enabled
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
          : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200")
      }
      aria-pressed={enabled}
      aria-label={enabled ? `auto-refresh on, next in ${sec}s` : "auto-refresh off"}
      title={enabled ? "click to pause" : "click to resume"}
    >
      <span
        className={
          "h-1.5 w-1.5 rounded-full " +
          (enabled ? "bg-emerald-300 animate-pulse" : "bg-neutral-600")
        }
      />
      {enabled ? `live · ${sec}s` : "paused"}
    </button>
  );
}
