"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface InboxItem {
  path: string;
  filename: string;
  title: string;
  body: string;
  approved: boolean;
  mtime: number;
}

export function InboxPanel() {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<"" | "submitting" | "approving" | "running">("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch("/api/inbox", { cache: "no-store" });
    const j = await r.json();
    setItems(j.items ?? []);
  };

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 4000);
    return () => window.clearInterval(id);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy("submitting");
    setMsg(null);
    try {
      const r = await fetch("/api/inbox?action=create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "submit failed");
      setTitle("");
      setBody("");
      setMsg(`queued · ${j.filename}`);
      await refresh();
    } catch (e) {
      setMsg(`error · ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };

  const approve = async (it: InboxItem) => {
    setBusy("approving");
    setMsg(null);
    try {
      const r = await fetch("/api/inbox?action=approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: it.path }),
      });
      if (!r.ok) throw new Error("approve failed");
      setMsg(`approved · ${it.filename}`);
      await refresh();
    } catch (e) {
      setMsg(`error · ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };

  const runItem = async (it: InboxItem) => {
    setBusy("running");
    setMsg(null);
    try {
      const r = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request: it.title,
          project_id: it.filename.replace(/\.md(\.approved)?$/, ""),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "run failed");
      setMsg(`spawned · pid ${j.pid} · project ${j.project_id}`);
      setTimeout(() => router.refresh(), 1200);
    } catch (e) {
      setMsg(`error · ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Inbox
        </h3>
        <span className="text-[10px] font-mono text-neutral-500">
          {items.filter((i) => !i.approved).length} pending · {items.length} total
        </span>
      </div>

      <form onSubmit={submit} className="mt-3 space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What should the company build?"
          className="w-full rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
          maxLength={140}
          disabled={!!busy}
          aria-label="request title"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="optional details, constraints, success criteria…"
          rows={2}
          className="w-full rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
          disabled={!!busy}
          aria-label="request body"
        />
        <button
          type="submit"
          disabled={!title.trim() || !!busy}
          className="w-full rounded bg-purple-500/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-purple-200 ring-1 ring-purple-400/40 transition hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "submitting" ? "queuing…" : "queue request"}
        </button>
      </form>

      {msg && (
        <p
          className={
            "mt-2 text-[10px] font-mono " +
            (msg.startsWith("error") ? "text-rose-300" : "text-emerald-300")
          }
        >
          {msg}
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[11px]">
          {items.slice(0, 6).map((it) => (
            <li
              key={it.path}
              className="rounded border border-neutral-800/70 bg-neutral-900/60 px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-neutral-200" title={it.title}>
                  {it.title}
                </span>
                {it.approved ? (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-emerald-300 ring-1 ring-emerald-500/30">
                    approved
                  </span>
                ) : (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-amber-300 ring-1 ring-amber-500/30">
                    pending
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-500">
                <span className="font-mono truncate">{it.filename}</span>
                <div className="flex items-center gap-1.5">
                  {!it.approved && (
                    <button
                      type="button"
                      onClick={() => approve(it)}
                      disabled={!!busy}
                      className="rounded border border-neutral-700 px-1.5 py-0.5 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-40"
                      aria-label={`approve ${it.title}`}
                    >
                      approve
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => runItem(it)}
                    disabled={!!busy}
                    className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-purple-200 hover:bg-purple-500/20 disabled:opacity-40"
                    aria-label={`run ${it.title}`}
                  >
                    run
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
