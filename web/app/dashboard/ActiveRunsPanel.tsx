"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ActiveRun {
  project_id: string;
  pid: number;
  request: string;
  startedAt: number;
  alive: boolean;
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

export function ActiveRunsPanel() {
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  async function load() {
    try {
      const res = await fetch("/api/runs", { cache: "no-store" });
      const data = (await res.json()) as { runs?: ActiveRun[] };
      setRuns(data.runs ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  async function cancel(projectId: string) {
    setBusy(projectId);
    try {
      await fetch(`/api/runs?project_id=${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });
      await load();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const alive = runs.filter((r) => r.alive);

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-neutral-400">
          Active runs
        </h3>
        <span className="text-[10px] tabular-nums text-neutral-500">
          {alive.length} running
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {alive.length === 0 && (
          <li className="text-xs text-neutral-500">No background runs.</li>
        )}
        {alive.map((r) => (
          <li
            key={r.project_id}
            className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-mono text-xs text-neutral-200">
                  {r.project_id}
                </div>
                <div className="truncate text-[11px] text-neutral-500" title={r.request}>
                  {r.request}
                </div>
              </div>
              <button
                type="button"
                onClick={() => cancel(r.project_id)}
                disabled={busy === r.project_id}
                className="rounded-md bg-rose-500/15 px-2 py-1 text-[11px] font-medium text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-500/25 disabled:opacity-50"
              >
                {busy === r.project_id ? "..." : "cancel"}
              </button>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span>pid {r.pid}</span>
              <span>·</span>
              <span>{ago(r.startedAt)} ago</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
