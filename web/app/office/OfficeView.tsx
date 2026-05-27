"use client";

import { useEffect, useMemo, useRef } from "react";
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

  return (
    <div className="grid grid-cols-[1fr_280px] gap-3 items-start">
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 relative">
        <div ref={stageRef} />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-3 right-3 top-2 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
              <span className="font-mono text-emerald-300/90">atelier://office</span>
              <span className="text-neutral-500">· 9 leads on duty</span>
            </div>
            <div className="font-mono text-neutral-400">
              gate: <span className="text-amber-300">idle</span> · quota:{" "}
              <span className="text-neutral-200">00%</span>
            </div>
          </div>
          {LEADS.map((l) => {
            const act = activity[l.dept];
            const busy = !!act;
            return (
              <div
                key={l.dept}
                className="absolute text-[10px] leading-tight font-medium text-center"
                style={{ left: l.x - 28, top: l.y + 108, width: 120 }}
              >
                <div
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 backdrop-blur-sm shadow-[0_2px_6px_rgba(0,0,0,0.5)] " +
                    (busy
                      ? "bg-emerald-500/15 ring-1 ring-emerald-400/60 text-emerald-200"
                      : "bg-amber-500/15 ring-1 ring-amber-400/50 text-amber-200")
                  }
                >
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (busy ? "bg-emerald-300 animate-pulse shadow-[0_0_6px_#34d399]" : "bg-amber-300")
                    }
                  />
                  {l.dept}
                </div>
                <div className="mt-0.5 rounded-sm bg-black/75 px-1.5 py-0.5 text-neutral-100 ring-1 ring-white/10">
                  {l.name}
                </div>
              </div>
            );
          })}
          {councilCount >= 2 && (
            <div
              className="absolute rounded-md bg-cyan-500/15 ring-1 ring-cyan-400/40 backdrop-blur-sm px-2.5 py-1.5 text-[10px] text-cyan-100 shadow-[0_2px_8px_rgba(34,211,238,0.25)]"
              style={{ right: 80, top: 90, maxWidth: 220 }}
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
        <div className="flex-1 overflow-auto p-2 space-y-1.5 text-[11px] font-mono">
          {recent.length === 0 ? (
            <div className="text-neutral-500 px-1 py-2">
              waiting for events…
              <div className="mt-1 text-neutral-600">
                runs publish to <code>runs/events.jsonl</code>
              </div>
            </div>
          ) : (
            recent.map((e, i) => (
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
                  <div className="text-amber-300/90 mt-0.5">{e.dept as string}</div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
