"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Assets, Sprite, Container, Rectangle, Texture } from "pixi.js";
import { useEventStream } from "@/lib/useEventStream";

const SPRITES = ["Adam", "Alex", "Amelia", "Bob"] as const;

type Lead = {
  dept: string;
  name: string;
  sprite: (typeof SPRITES)[number];
  x: number;
  y: number;
};

const LEADS: Lead[] = [
  { dept: "Chief", name: "Chief of Staff", sprite: "Adam", x: 80, y: 130 },
  { dept: "Strategy", name: "BizDev Lead", sprite: "Alex", x: 288, y: 130 },
  { dept: "Product", name: "PM Lead", sprite: "Amelia", x: 496, y: 130 },
  { dept: "Design", name: "Design Lead", sprite: "Bob", x: 80, y: 262 },
  { dept: "Engineering", name: "Eng Manager", sprite: "Adam", x: 288, y: 262 },
  { dept: "QA", name: "QA Lead", sprite: "Alex", x: 496, y: 262 },
  { dept: "Marketing", name: "Mkt Lead", sprite: "Amelia", x: 80, y: 394 },
  { dept: "Operations", name: "Ops Lead", sprite: "Bob", x: 288, y: 394 },
  { dept: "Analytics", name: "Analytics Lead", sprite: "Adam", x: 496, y: 394 },
];

export default function OfficeView() {
  const stageRef = useRef<HTMLDivElement>(null);
  const events = useEventStream("/api/events");
  const spriteMap = useRef(new Map<string, Sprite>());

  useEffect(() => {
    const host = stageRef.current;
    if (!host) return;

    const app = new Application();
    let destroyed = false;

    (async () => {
      await app.init({
        width: 960,
        height: 540,
        backgroundColor: 0x141420,
        antialias: false,
      });
      if (destroyed) return;
      app.canvas.style.maxWidth = "100%";
      app.canvas.style.height = "auto";
      app.canvas.style.display = "block";
      host.appendChild(app.canvas);

      const roomTex = await Assets.load("/office-bg.png");
      const room = new Sprite(roomTex);
      app.stage.addChild(room);

      const charLayer = new Container();
      app.stage.addChild(charLayer);

      const FRAME_W = 16;
      const FRAME_H = 32;
      const FRAMES = 4;

      const animEntries: { sp: Sprite; frames: Texture[] }[] = [];
      for (const lead of LEADS) {
        const base: Texture = await Assets.load(
          `/assets/modern-interiors/characters/${lead.sprite}_idle_16x16.png`,
        );
        const frames: Texture[] = [];
        for (let i = 0; i < FRAMES; i++) {
          frames.push(
            new Texture({
              source: base.source,
              frame: new Rectangle(i * FRAME_W, 0, FRAME_W, FRAME_H),
            }),
          );
        }
        const sp = new Sprite(frames[0]);
        sp.scale.set(2);
        sp.x = lead.x;
        sp.y = lead.y;
        charLayer.addChild(sp);
        spriteMap.current.set(lead.dept, sp);
        animEntries.push({ sp, frames });
      }

      let elapsed = 0;
      app.ticker.add((ticker) => {
        elapsed += ticker.deltaMS;
        const idx = Math.floor(elapsed / 220) % FRAMES;
        for (const { sp, frames } of animEntries) {
          if (sp.texture !== frames[idx]) sp.texture = frames[idx];
        }
      });
    })();

    return () => {
      destroyed = true;
      app.destroy(true, { children: true });
      while (host.firstChild) host.removeChild(host.firstChild);
      spriteMap.current.clear();
    };
  }, []);

  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;
    const dept = typeof last.dept === "string" ? last.dept : undefined;
    if (!dept) return;
    const sp = spriteMap.current.get(dept);
    if (!sp) return;
    const start = performance.now();
    const baseY = sp.y;
    const tick = () => {
      const t = (performance.now() - start) / 400;
      if (t >= 1) {
        sp.y = baseY;
        return;
      }
      sp.y = baseY - Math.sin(t * Math.PI) * 6;
      requestAnimationFrame(tick);
    };
    tick();
  }, [events]);

  const recent = useMemo(() => events.slice(-12).reverse(), [events]);

  const activity = useMemo(() => {
    const map: Record<string, { kind: string; ts: string }> = {};
    for (const e of events) {
      if (typeof e.dept === "string") {
        map[e.dept] = { kind: e.event as string, ts: e.ts as string };
      }
    }
    return map;
  }, [events]);

  const councilCount = useMemo(
    () =>
      new Set(
        events
          .slice(-12)
          .map((e) => (typeof e.dept === "string" ? e.dept : null))
          .filter(Boolean),
      ).size,
    [events],
  );

  const currentGate = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const m = /^g([1-5])\./.exec(String(events[i].event ?? ""));
      if (m) return `G${m[1]}`;
    }
    return null;
  }, [events]);

  const quotaTotal = useMemo(() => {
    let sum = 0;
    for (const e of events) {
      if (e.event === "quota.charge" && typeof e.frac === "number") sum += e.frac;
    }
    return sum;
  }, [events]);

  const [filterDept, setFilterDept] = useState<string | null>(null);
  const filtered = useMemo(
    () => (filterDept ? recent.filter((e) => e.dept === filterDept) : recent),
    [recent, filterDept],
  );

  return (
    <div className="grid grid-cols-1 gap-3 items-start lg:grid-cols-[1fr_280px]">
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 relative">
        <div ref={stageRef} style={{ aspectRatio: "960 / 540" }} />
        <div className="pointer-events-none absolute inset-0" style={{ aspectRatio: "960 / 540" }}>
          <div className="absolute left-3 right-3 top-2 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
              <span className="font-mono text-emerald-300/90">atelier://office</span>
              <span className="text-neutral-500">· 9 leads on duty</span>
            </div>
            <div className="hidden sm:block font-mono text-neutral-400">
              gate:{" "}
              <span className={currentGate ? "text-emerald-300" : "text-amber-300"}>
                {currentGate ?? "idle"}
              </span>{" "}
              · quota:{" "}
              <span className="text-neutral-200 tabular-nums">
                {(quotaTotal * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          {LEADS.map((l) => {
            const act = activity[l.dept];
            const busy = !!act;
            const selected = filterDept === l.dept;
            return (
              <div
                key={l.dept}
                className="absolute hidden md:block text-[10px] leading-tight font-medium text-center pointer-events-auto"
                style={{
                  left: `${((l.x - 28) / 960) * 100}%`,
                  top: `${((l.y + 108) / 540) * 100}%`,
                  width: `${(120 / 960) * 100}%`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setFilterDept(selected ? null : l.dept)}
                  aria-label={`Filter events to ${l.dept}`}
                  aria-pressed={selected}
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-[0_2px_6px_rgba(0,0,0,0.5)] cursor-pointer transition " +
                    (selected
                      ? "bg-purple-500/30 ring-1 ring-purple-300 text-purple-100"
                      : busy
                      ? "bg-emerald-500/15 ring-1 ring-emerald-400/60 text-emerald-200 hover:bg-emerald-500/25"
                      : "bg-amber-500/15 ring-1 ring-amber-400/50 text-amber-200 hover:bg-amber-500/25")
                  }
                >
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (selected
                        ? "bg-purple-300 shadow-[0_0_6px_#d8b4fe]"
                        : busy
                        ? "bg-emerald-300 animate-pulse shadow-[0_0_6px_#34d399]"
                        : "bg-amber-300")
                    }
                  />
                  {l.dept}
                </button>
                <div className="mt-0.5 rounded-sm bg-black/75 px-1.5 py-0.5 text-neutral-100 ring-1 ring-white/10">
                  {l.name}
                </div>
              </div>
            );
          })}
          {councilCount >= 2 && (
            <div
              className="absolute hidden md:block rounded-md bg-cyan-500/15 ring-1 ring-cyan-400/40 backdrop-blur-sm px-2.5 py-1.5 text-[10px] text-cyan-100 shadow-[0_2px_8px_rgba(34,211,238,0.25)]"
              style={{
                right: `${(80 / 960) * 100}%`,
                top: `${(90 / 540) * 100}%`,
                maxWidth: 220,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
                <span className="font-semibold uppercase tracking-widest">Cross-Dept Council</span>
              </div>
              <div className="mt-0.5 text-cyan-200/80 whitespace-nowrap">
                {councilCount} departments active
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-400">
          events received: <span className="text-neutral-200">{events.length}</span>
        </div>
      </div>

      <aside className="rounded-xl border border-neutral-800 bg-neutral-950 flex flex-col" style={{ maxHeight: 590 }}>
        <div className="px-3 py-2 border-b border-neutral-800 text-xs font-semibold text-neutral-300 flex items-center justify-between">
          <span>live event log</span>
          <span className="text-[10px] font-mono text-neutral-500">{events.length} total</span>
        </div>
        {filterDept && (
          <div className="px-3 py-1.5 border-b border-neutral-800 bg-purple-500/10 text-[11px] flex items-center justify-between">
            <span className="text-purple-200">
              filtered: <span className="font-semibold">{filterDept}</span>
            </span>
            <button
              type="button"
              onClick={() => setFilterDept(null)}
              className="text-[10px] text-purple-300 hover:text-purple-100 underline-offset-2 hover:underline"
            >
              clear
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto p-2 space-y-1.5 text-[11px] font-mono">
          {filtered.length === 0 ? (
            <div className="text-neutral-500 px-1 py-2">
              {filterDept
                ? `no recent events for ${filterDept}.`
                : "waiting for events…"}
              {!filterDept && (
                <div className="mt-1 text-neutral-600">
                  runs publish to <code>runs/events.jsonl</code>
                </div>
              )}
            </div>
          ) : (
            filtered.map((e, i) => (
              <div
                key={`${e.ts}-${i}`}
                className="rounded border border-neutral-800/80 bg-neutral-900/60 px-2 py-1"
              >
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="truncate">{e.event}</span>
                  <span className="text-neutral-600 tabular-nums">
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                </div>
                {typeof e.dept === "string" && (
                  <button
                    type="button"
                    onClick={() => setFilterDept(e.dept as string)}
                    className="text-amber-300/90 mt-0.5 hover:text-amber-200 hover:underline underline-offset-2 cursor-pointer"
                  >
                    {e.dept as string}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
