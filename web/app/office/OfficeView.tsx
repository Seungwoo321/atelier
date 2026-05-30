"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Application, Assets, Sprite, Container, Rectangle, Texture, Graphics } from "pixi.js";
import { useEventStream } from "@/lib/useEventStream";

type Base = "Adam" | "Alex" | "Amelia" | "Bob";

type Lead = {
  dept: string;
  name: string;
  base: Base;
  tint: number;
  x: number;
  y: number;
};

interface RolesResponse {
  byDept: Record<string, { tier: "lead" | "specialist"; name: string }[]>;
}

const WORLD_W = 1920;
const WORLD_H = 1600;
const ROOM_W = 480;
const ROOM_H = 320;
const ROOM_GAP = 60;
const COUNCIL_GAP = 80;
const COUNCIL_H = 280;
const MARGIN_X = (WORLD_W - 3 * ROOM_W - 2 * ROOM_GAP) / 2;
const MARGIN_Y = (WORLD_H - (3 * ROOM_H + 2 * ROOM_GAP + COUNCIL_GAP + COUNCIL_H)) / 2;
const COUNCIL_Y0 = MARGIN_Y + 3 * ROOM_H + 2 * ROOM_GAP + COUNCIL_GAP;
const COUNCIL_Y1 = COUNCIL_Y0 + COUNCIL_H;
const COUNCIL_X0 = MARGIN_X;
const COUNCIL_X1 = MARGIN_X + 3 * ROOM_W + 2 * ROOM_GAP;
const WALL = 8;

function roomOrigin(col: number, row: number) {
  return {
    x: MARGIN_X + col * (ROOM_W + ROOM_GAP),
    y: MARGIN_Y + row * (ROOM_H + ROOM_GAP),
  };
}

function roomCenter(col: number, row: number) {
  const o = roomOrigin(col, row);
  return { x: o.x + ROOM_W / 2, y: o.y + ROOM_H / 2 };
}

// 9 dept leads (Council is a separate hall, not a dept).
const LEADS: Lead[] = (() => {
  const place = (col: number, row: number) => {
    const o = roomOrigin(col, row);
    return { x: o.x + 80, y: o.y + 130 };
  };
  const make = (dept: string, name: string, base: Base, tint: number, col: number, row: number): Lead => {
    const p = place(col, row);
    return { dept, name, base, tint, x: p.x, y: p.y };
  };
  return [
    make("Chief", "Chief of Staff", "Adam", 0xffffff, 0, 0),
    make("Strategy", "BizDev Lead", "Alex", 0xffe1a8, 1, 0),
    make("Product", "PM Lead", "Amelia", 0xffffff, 2, 0),
    make("Design", "Design Lead", "Bob", 0xffffff, 0, 1),
    make("Engineering", "Eng Manager", "Adam", 0xaccbff, 1, 1),
    make("QA", "QA Lead", "Bob", 0xa9f0c4, 2, 1),
    make("Marketing", "Mkt Lead", "Amelia", 0xffb3d4, 0, 2),
    make("Operations", "Ops Lead", "Alex", 0xffc39c, 1, 2),
    make("Analytics", "Analytics Lead", "Bob", 0x9fe4ff, 2, 2),
  ];
})();

const FRAME_W = 16;
const FRAME_H = 32;
const SCALE = 2;
const WALK_SPEED = 110;
const PLAYER_SPEED = 170;


// Axis-aligned walkable rects: 9 room interiors + inter-room corridors + Council hall + connector strips.
const WALKABLE: { x: number; y: number; w: number; h: number }[] = (() => {
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      const o = roomOrigin(col, row);
      rects.push({ x: o.x + WALL, y: o.y + WALL, w: ROOM_W - 2 * WALL, h: ROOM_H - 2 * WALL });
      if (col < 2) {
        rects.push({
          x: o.x + ROOM_W - WALL,
          y: o.y + ROOM_H / 2 - 24,
          w: ROOM_GAP + 2 * WALL,
          h: 48,
        });
      }
      if (row < 2) {
        rects.push({
          x: o.x + ROOM_W / 2 - 24,
          y: o.y + ROOM_H - WALL,
          w: 48,
          h: ROOM_GAP + 2 * WALL,
        });
      }
      if (row === 2) {
        rects.push({
          x: o.x + ROOM_W / 2 - 28,
          y: o.y + ROOM_H - WALL,
          w: 56,
          h: COUNCIL_GAP + 2 * WALL,
        });
      }
    }
  }
  rects.push({
    x: COUNCIL_X0 + WALL,
    y: COUNCIL_Y0 + WALL,
    w: COUNCIL_X1 - COUNCIL_X0 - 2 * WALL,
    h: COUNCIL_Y1 - COUNCIL_Y0 - 2 * WALL,
  });
  return rects;
})();

function isWalkable(x: number, y: number): boolean {
  for (const r of WALKABLE) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

type Clips = { idle: Texture[]; walk: Texture[][]; phone: Texture[] };

class NpcCtl {
  cur: Texture[];
  fi = 0;
  ft = 0;
  fps = 7;
  mode: "idle" | "walk" | "phone" = "idle";
  target: { x: number; y: number } | null = null;
  meetUntil = 0;
  phoneUntil = 0;
  busyUntil = 0;

  constructor(
    readonly sp: Sprite,
    readonly clips: Clips,
    readonly home: { x: number; y: number },
    readonly bounds: { x0: number; y0: number; x1: number; y1: number },
    seed: number,
  ) {
    this.cur = clips.idle;
    this.ft = seed;
  }

  private setClip(c: Texture[], fps: number) {
    if (this.cur !== c) {
      this.cur = c;
      this.fi = 0;
      this.ft = 0;
    }
    this.fps = fps;
  }

  private faceFrames(dx: number, dy: number) {
    const d = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : dy < 0 ? 1 : 0;
    return this.clips.walk[d];
  }

  private wanderTarget() {
    const x = this.bounds.x0 + Math.random() * (this.bounds.x1 - this.bounds.x0);
    const y = this.bounds.y0 + Math.random() * (this.bounds.y1 - this.bounds.y0);
    return { x, y };
  }

  onEvent(name: string, now: number) {
    if (name.startsWith("specialist")) {
      this.phoneUntil = now + 3200;
      if (this.mode !== "walk") {
        this.mode = "phone";
        this.setClip(this.clips.phone, 7);
      }
      return;
    }
    this.busyUntil = now + 6000;
    if (this.mode !== "walk") {
      this.target = this.wanderTarget();
      this.mode = "walk";
    }
  }

  update(dtMs: number, now: number) {
    if (this.mode === "phone" && now >= this.phoneUntil) {
      this.mode = "idle";
      this.setClip(this.clips.idle, 7);
    }
    if (this.mode === "walk" && this.target) {
      const dx = this.target.x - this.sp.x;
      const dy = this.target.y - this.sp.y;
      const dist = Math.hypot(dx, dy);
      const step = (WALK_SPEED * dtMs) / 1000;
      if (dist <= step || dist < 1.5) {
        this.sp.x = this.target.x;
        this.sp.y = this.target.y;
        this.target = null;
        if (now < this.busyUntil) {
          this.target = this.wanderTarget();
        } else {
          this.mode = "idle";
          this.setClip(this.clips.idle, 7);
        }
      } else {
        this.sp.x += (dx / dist) * step;
        this.sp.y += (dy / dist) * step;
        this.setClip(this.faceFrames(dx, dy), 10);
      }
    }
    this.ft += dtMs;
    const interval = 1000 / this.fps;
    while (this.ft >= interval) {
      this.ft -= interval;
      this.fi = (this.fi + 1) % this.cur.length;
    }
    const tex = this.cur[this.fi];
    if (this.sp.texture !== tex) this.sp.texture = tex;
  }
}

export default function OfficeView() {
  const stageRef = useRef<HTMLDivElement>(null);
  const events = useEventStream("/api/events");
  const spriteMap = useRef(new Map<string, Sprite>());
  const ctlMap = useRef(new Map<string, NpcCtl>());
  const particleLayerRef = useRef<Container | null>(null);
  const spawn = roomCenter(1, 1);
  const playerRef = useRef<{ x: number; y: number }>({ x: spawn.x, y: spawn.y });
  const [playerPos, setPlayerPos] = useState<{ x: number; y: number }>({ x: spawn.x, y: spawn.y });

  useEffect(() => {
    const host = stageRef.current;
    if (!host) return;

    const app = new Application();
    let destroyed = false;
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
        keys.add(e.key.toLowerCase());
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    (async () => {
      await app.init({
        resizeTo: window,
        backgroundColor: 0x141420,
        antialias: false,
      });
      if (destroyed) return;
      app.canvas.style.display = "block";
      app.canvas.style.position = "absolute";
      app.canvas.style.inset = "0";
      host.appendChild(app.canvas);

      const world = new Container();
      app.stage.addChild(world);

      const roomTex = await Assets.load("/office-bg.png");
      const room = new Sprite(roomTex);
      world.addChild(room);

      const charLayer = new Container();
      world.addChild(charLayer);

      const particleLayer = new Container();
      world.addChild(particleLayer);
      particleLayerRef.current = particleLayer;

      const loadFrames = async (path: string, count: number) => {
        const base: Texture = await Assets.load(path);
        const out: Texture[] = [];
        for (let i = 0; i < count; i++) {
          out.push(
            new Texture({
              source: base.source,
              frame: new Rectangle(i * FRAME_W, 0, FRAME_W, FRAME_H),
            }),
          );
        }
        return out;
      };
      const dirBlock = (arr: Texture[], d: number) => arr.slice(d * 6, d * 6 + 6);

      const ctls: NpcCtl[] = [];
      let seed = 0;
      const leadCol: Record<string, number> = { Chief: 0, Strategy: 1, Product: 2, Design: 0, Engineering: 1, QA: 2, Marketing: 0, Operations: 1, Analytics: 2 };
      const leadRow: Record<string, number> = { Chief: 0, Strategy: 0, Product: 0, Design: 1, Engineering: 1, QA: 1, Marketing: 2, Operations: 2, Analytics: 2 };
      for (const lead of LEADS) {
        const root = `/assets/modern-interiors/characters/${lead.base}`;
        const [idleAnim, run, phone] = await Promise.all([
          loadFrames(`${root}_idle_anim_16x16.png`, 24),
          loadFrames(`${root}_run_16x16.png`, 24),
          loadFrames(`${root}_phone_16x16.png`, 9),
        ]);
        if (destroyed) return;
        const clips: Clips = {
          idle: dirBlock(idleAnim, 0),
          walk: [dirBlock(run, 0), dirBlock(run, 1), dirBlock(run, 2), dirBlock(run, 3)],
          phone,
        };
        const sp = new Sprite(clips.idle[0]);
        sp.scale.set(SCALE);
        sp.tint = lead.tint;
        sp.x = lead.x;
        sp.y = lead.y;
        charLayer.addChild(sp);
        spriteMap.current.set(lead.dept, sp);
        const o = roomOrigin(leadCol[lead.dept], leadRow[lead.dept]);
        const bounds = {
          x0: o.x + WALL + 20,
          y0: o.y + WALL + 60,
          x1: o.x + ROOM_W - WALL - 60,
          y1: o.y + ROOM_H - WALL - 80,
        };
        const ctl = new NpcCtl(sp, clips, { x: lead.x, y: lead.y }, bounds, (seed += 37) % 400);
        ctls.push(ctl);
        ctlMap.current.set(lead.dept, ctl);
      }

      // Player avatar (Amelia, visually distinct cyan tint).
      const playerIdle = await loadFrames("/assets/modern-interiors/characters/Amelia_idle_anim_16x16.png", 24);
      const playerRun = await loadFrames("/assets/modern-interiors/characters/Amelia_run_16x16.png", 24);
      if (destroyed) return;
      const playerClips = {
        idle: [dirBlock(playerIdle, 0), dirBlock(playerIdle, 1), dirBlock(playerIdle, 2), dirBlock(playerIdle, 3)],
        run: [dirBlock(playerRun, 0), dirBlock(playerRun, 1), dirBlock(playerRun, 2), dirBlock(playerRun, 3)],
      };
      const player = new Sprite(playerClips.idle[0][0]);
      player.scale.set(SCALE);
      player.tint = 0x9fffe6;
      player.x = playerRef.current.x - FRAME_W;
      player.y = playerRef.current.y - FRAME_H;
      charLayer.addChild(player);

      let pCur = playerClips.idle[0];
      let pFi = 0;
      let pFt = 0;
      let pDir = 0;
      let pMoving = false;
      let camX = playerRef.current.x;
      let camY = playerRef.current.y;

      app.ticker.add((ticker) => {
        const dtMs = ticker.deltaMS;
        const now = performance.now();
        for (const c of ctls) c.update(dtMs, now);

        let vx = 0;
        let vy = 0;
        if (keys.has("w") || keys.has("arrowup")) vy -= 1;
        if (keys.has("s") || keys.has("arrowdown")) vy += 1;
        if (keys.has("a") || keys.has("arrowleft")) vx -= 1;
        if (keys.has("d") || keys.has("arrowright")) vx += 1;
        const mag = Math.hypot(vx, vy);
        if (mag > 0) {
          vx /= mag;
          vy /= mag;
        }
        const step = (PLAYER_SPEED * dtMs) / 1000;
        const cx = playerRef.current.x;
        const cy = playerRef.current.y;
        const nxRaw = cx + vx * step;
        const nyRaw = cy + vy * step;
        let nx = cx;
        let ny = cy;
        if (vx !== 0 && isWalkable(nxRaw, cy)) nx = nxRaw;
        if (vy !== 0 && isWalkable(nx, nyRaw)) ny = nyRaw;
        playerRef.current.x = nx;
        playerRef.current.y = ny;
        player.x = nx - FRAME_W;
        player.y = ny - FRAME_H;

        const moving = mag > 0;
        const dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 2 : 3) : vy < 0 ? 1 : 0;
        if (moving) pDir = dir;
        const clipNow = moving ? playerClips.run[pDir] : playerClips.idle[pDir];
        if (clipNow !== pCur || moving !== pMoving) {
          pCur = clipNow;
          pFi = 0;
          pFt = 0;
          pMoving = moving;
        }
        const fps = moving ? 10 : 7;
        pFt += dtMs;
        const interval = 1000 / fps;
        while (pFt >= interval) {
          pFt -= interval;
          pFi = (pFi + 1) % pCur.length;
        }
        const tex = pCur[pFi];
        if (player.texture !== tex) player.texture = tex;

        const targetCamX = playerRef.current.x;
        const targetCamY = playerRef.current.y;
        const lerp = Math.min(1, dtMs / 120);
        camX += (targetCamX - camX) * lerp;
        camY += (targetCamY - camY) * lerp;
        const sw = app.renderer.width;
        const sh = app.renderer.height;
        let ox = sw / 2 - camX;
        let oy = sh / 2 - camY;
        if (WORLD_W < sw) ox = (sw - WORLD_W) / 2;
        else ox = Math.min(0, Math.max(sw - WORLD_W, ox));
        if (WORLD_H < sh) oy = (sh - WORLD_H) / 2;
        else oy = Math.min(0, Math.max(sh - WORLD_H, oy));
        world.x = Math.round(ox);
        world.y = Math.round(oy);

        setPlayerPos({ x: playerRef.current.x, y: playerRef.current.y });
      });
    })();

    return () => {
      destroyed = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      app.destroy(true, { children: true });
      while (host.firstChild) host.removeChild(host.firstChild);
      spriteMap.current.clear();
      ctlMap.current.clear();
    };
  }, []);

  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;
    const dept = typeof last.dept === "string" ? last.dept : undefined;
    if (!dept) return;
    const ctl = ctlMap.current.get(dept);
    if (ctl) ctl.onEvent(typeof last.event === "string" ? last.event : "", performance.now());

    const sp = spriteMap.current.get(dept);
    if (!sp) return;
    const layer = particleLayerRef.current;
    const chief = spriteMap.current.get("Chief");
    if (layer && chief && dept !== "Chief") {
      const x0 = chief.x + 16;
      const y0 = chief.y + 16;
      const x1 = sp.x + 16;
      const y1 = sp.y + 16;
      const dot = new Graphics().circle(0, 0, 4).fill({ color: 0xfde68a, alpha: 0.95 });
      dot.x = x0;
      dot.y = y0;
      layer.addChild(dot);
      const t0 = performance.now();
      const animate = () => {
        const t = Math.min(1, (performance.now() - t0) / 700);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        dot.x = x0 + (x1 - x0) * e;
        dot.y = y0 + (y1 - y0) * e - Math.sin(t * Math.PI) * 24;
        dot.alpha = t < 0.85 ? 0.95 : (1 - t) / 0.15;
        if (t >= 1) {
          layer.removeChild(dot);
          dot.destroy();
          return;
        }
        requestAnimationFrame(animate);
      };
      animate();
    }
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

  const sparkBins = useMemo(() => {
    const BUCKETS = 12;
    const WINDOW_MS = 60_000;
    const stamps: number[] = [];
    for (const e of events) {
      const t = typeof e.ts === "string" ? Date.parse(e.ts) : Number.NaN;
      if (Number.isFinite(t)) stamps.push(t);
    }
    if (stamps.length === 0) return { bins: new Array(BUCKETS).fill(0), max: 1 };
    const last = Math.max(...stamps);
    const start = last - WINDOW_MS;
    const bins = new Array(BUCKETS).fill(0);
    for (const t of stamps) {
      if (t < start) continue;
      const idx = Math.min(BUCKETS - 1, Math.floor(((t - start) / WINDOW_MS) * BUCKETS));
      bins[idx] += 1;
    }
    return { bins, max: Math.max(1, ...bins) };
  }, [events]);

  const [filterDept, setFilterDept] = useState<string | null>(null);
  const [specCount, setSpecCount] = useState<Record<string, number>>({});
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/roles");
        if (!res.ok) return;
        const data: RolesResponse = await res.json();
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const [dept, roles] of Object.entries(data.byDept ?? {})) {
          counts[dept] = roles.filter((r) => r.tier === "specialist").length;
        }
        setSpecCount(counts);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const specActivity = useMemo(() => {
    const map: Record<string, number> = {};
    const cutoff = Date.now() - 8000;
    for (const e of events) {
      if (typeof e.event !== "string" || !e.event.startsWith("specialist.")) continue;
      const dept = typeof e.dept === "string" ? e.dept : null;
      if (!dept) continue;
      const t = typeof e.ts === "string" ? Date.parse(e.ts) : Number.NaN;
      if (Number.isFinite(t) && t >= cutoff) map[dept] = (map[dept] ?? 0) + 1;
    }
    return map;
  }, [events]);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("dept");
    if (initial) setFilterDept(initial);
  }, []);

  useEffect(() => {
    for (const [dept, sp] of spriteMap.current.entries()) {
      sp.alpha = filterDept && dept !== filterDept ? 0.35 : 1;
    }
  }, [filterDept]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (filterDept) setFilterDept(null);
        else setShowHelp((v) => !v);
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) setShowHelp((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filterDept]);

  const filtered = useMemo(
    () => (filterDept ? recent.filter((e) => e.dept === filterDept) : recent),
    [recent, filterDept],
  );

  const specialistTotal = Object.values(specCount).reduce((a, b) => a + b, 0);

  return (
    <div className="relative h-full w-full">
      <div ref={stageRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-black/65 px-3 py-2 text-[11px] backdrop-blur-md ring-1 ring-white/10">
          <Link href="/" className="text-neutral-300 hover:text-white" title="back to home">
            ←
          </Link>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
          <span className="font-mono text-emerald-300/90">atelier://office</span>
          <span className="text-neutral-500">
            {LEADS.length} leads on duty{specialistTotal > 0 ? ` + ${specialistTotal} specialists` : ""}
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-black/65 px-3 py-2 text-[11px] font-mono backdrop-blur-md ring-1 ring-white/10">
          <span>
            gate:{" "}
            <span className={currentGate ? "text-emerald-300" : "text-amber-300"}>
              {currentGate ?? "idle"}
            </span>
          </span>
          <span>
            quota:{" "}
            <span className="text-neutral-200 tabular-nums">{(quotaTotal * 100).toFixed(1)}%</span>
          </span>
          <span className="text-neutral-500 tabular-nums">
            {Math.round(playerPos.x)},{Math.round(playerPos.y)}
          </span>
        </div>
      </div>

      {councilCount >= 2 && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-md bg-cyan-500/15 px-2.5 py-1.5 text-[10px] text-cyan-100 ring-1 ring-cyan-400/40 backdrop-blur-sm shadow-[0_2px_8px_rgba(34,211,238,0.25)]">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
            <span className="font-semibold uppercase tracking-widest">Cross-Dept Council</span>
            <span className="text-cyan-200/80">· {councilCount} active</span>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="pointer-events-auto absolute bottom-3 left-3 z-10 rounded-lg bg-black/70 px-3 py-2 text-[11px] text-neutral-200 ring-1 ring-white/10 backdrop-blur-md">
          <div className="font-semibold text-neutral-100">walk the office</div>
          <div className="mt-1 text-neutral-400">
            <kbd className="rounded border border-white/10 bg-white/5 px-1 font-mono text-[10px]">W A S D</kbd>{" "}
            or arrow keys · <kbd className="rounded border border-white/10 bg-white/5 px-1 font-mono text-[10px]">Esc</kbd>{" "}
            to dismiss
          </div>
        </div>
      )}

      <aside className="absolute right-3 top-16 z-10 flex w-[300px] max-h-[calc(100vh-5.5rem)] flex-col rounded-xl border border-white/10 bg-neutral-950/85 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300">
          <span>live event log</span>
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 60 14"
              width={60}
              height={14}
              aria-label={`activity over last 60s, peak ${sparkBins.max}`}
              role="img"
              className="shrink-0"
            >
              {sparkBins.bins.map((v, i) => {
                const h = (v / sparkBins.max) * 12;
                return (
                  <rect
                    key={i}
                    x={i * 5}
                    y={14 - h}
                    width={3.5}
                    height={Math.max(h, 0.6)}
                    rx={0.6}
                    fill={v > 0 ? "rgb(168 85 247 / 0.85)" : "rgb(82 82 91 / 0.55)"}
                  />
                );
              })}
            </svg>
            <span className="text-[10px] font-mono text-neutral-500 tabular-nums">
              {filterDept ? `${filtered.length}/${events.length}` : `${events.length}`}
            </span>
          </div>
        </div>
        {filterDept && (
          <div className="flex items-center justify-between border-b border-white/10 bg-purple-500/10 px-3 py-1.5 text-[11px]">
            <span className="text-purple-200">
              filtered: <span className="font-semibold">{filterDept}</span>
            </span>
            <button
              type="button"
              onClick={() => setFilterDept(null)}
              className="flex items-center gap-1 text-[10px] text-purple-300 hover:text-purple-100"
              title="press Esc"
            >
              <kbd className="rounded border border-purple-400/30 bg-purple-500/10 px-1 py-px font-mono text-[9px] text-purple-200">
                Esc
              </kbd>
              <span className="underline-offset-2 hover:underline">clear</span>
            </button>
          </div>
        )}
        <div
          className="flex-1 space-y-1.5 overflow-auto p-2 font-mono text-[11px]"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="live event log"
        >
          {filtered.length === 0 ? (
            <div className="px-1 py-2 text-neutral-500">
              {filterDept ? `no recent events for ${filterDept}.` : "waiting for events…"}
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
                className="rounded border border-white/10 bg-neutral-900/60 px-2 py-1"
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
                    className="mt-0.5 cursor-pointer text-amber-300/90 hover:text-amber-200 hover:underline underline-offset-2"
                  >
                    {e.dept as string}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        <div className="grid grid-cols-2 gap-1 border-t border-white/10 px-2 py-2 text-[10px]">
          {LEADS.map((l) => {
            const busy = !!activity[l.dept];
            const selected = filterDept === l.dept;
            const spec = specCount[l.dept] ?? 0;
            const buzz = specActivity[l.dept];
            return (
              <button
                key={l.dept}
                type="button"
                onClick={() => setFilterDept(selected ? null : l.dept)}
                aria-pressed={selected}
                className={
                  "flex items-center justify-between gap-1 rounded px-1.5 py-1 transition " +
                  (selected
                    ? "bg-purple-500/30 ring-1 ring-purple-300 text-purple-100"
                    : busy
                    ? "bg-emerald-500/15 ring-1 ring-emerald-400/50 text-emerald-200 hover:bg-emerald-500/25"
                    : "bg-neutral-800/60 ring-1 ring-white/10 text-neutral-300 hover:bg-neutral-800")
                }
              >
                <span className="flex items-center gap-1 truncate">
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (selected
                        ? "bg-purple-300"
                        : busy
                        ? "bg-emerald-300 animate-pulse"
                        : "bg-neutral-500")
                    }
                  />
                  <span className="truncate">{l.dept}</span>
                </span>
                {spec > 0 && (
                  <span
                    className={
                      "tabular-nums " + (buzz ? "text-fuchsia-300" : "text-neutral-500")
                    }
                  >
                    +{spec}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
