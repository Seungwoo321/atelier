"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Application,
  Assets,
  Container,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
} from "pixi.js";
import { useEventStream } from "@/lib/useEventStream";
import { FURNITURE, FLOORS, WALL, TILE, tileUrl } from "@/lib/office/tiles";
import { DEFAULT_LAYOUT, DEPT_SEATS, LAYOUTS, type Layout, type Seat } from "@/lib/office/layout";

const SCALE = 3; // screen px per source px → 48px tiles, camera shows ~1 pod
const FRAME_W = 16;
const FRAME_H = 32;
const PLAYER_SPEED = 130; // source px/s
const NPC_SPEED = 70;

type Base = "Adam" | "Alex" | "Amelia" | "Bob";

interface RoleInfo {
  department: string;
  name: string;
  tier: "lead" | "specialist";
}
interface RolesResponse {
  byDept: Record<string, RoleInfo[]>;
  total: number;
}

const DEPT_STYLE: Record<string, { base: Base; tint: number }> = {
  Chief: { base: "Adam", tint: 0xffffff },
  Strategy: { base: "Alex", tint: 0xffe1a8 },
  Product: { base: "Amelia", tint: 0xffffff },
  Design: { base: "Bob", tint: 0xbfe3ff },
  Engineering: { base: "Adam", tint: 0xaccbff },
  QA: { base: "Bob", tint: 0xa9f0c4 },
  Marketing: { base: "Amelia", tint: 0xffb3d4 },
  Operations: { base: "Alex", tint: 0xffc39c },
  Analytics: { base: "Bob", tint: 0x9fe4ff },
};

// Current phase = plan/design/build → these pods are lively by default.
const DEFAULT_ACTIVE = ["Chief", "Strategy", "Product", "Design", "Engineering"];

type Clips = { idle: Texture[][]; walk: Texture[][]; phone: Texture[] };

// Verified against the LimeZu sheets: block 0=down, 1=up, 2=left, 3=right.
function faceDir(dx: number, dy: number): number {
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : dy < 0 ? 1 : 0;
}

class Npc {
  cur: Texture[];
  fi = 0;
  ft = 0;
  fps = 6;
  dir = 0;
  mode: "idle" | "walk" | "phone" = "idle";
  target: { x: number; y: number } | null = null;
  goingHome = false;
  meetUntil = 0;
  phoneUntil = 0;
  slot = -1;

  constructor(
    readonly sp: Sprite,
    readonly clips: Clips,
    readonly homeX: number,
    readonly homeY: number,
    readonly homeDir: number,
    seed: number,
  ) {
    this.dir = homeDir;
    this.cur = clips.idle[homeDir];
    this.ft = seed;
  }

  private set(c: Texture[], fps: number) {
    if (this.cur !== c) {
      this.cur = c;
      this.fi = 0;
    }
    this.fps = fps;
  }

  toCouncil(seat: Seat, slot: number, now: number) {
    this.slot = slot;
    this.meetUntil = now + 6000;
    this.goingHome = false;
    this.target = { x: seat.x * TILE, y: seat.y * TILE - TILE };
    this.mode = "walk";
  }

  phone(now: number) {
    if (this.mode === "walk") return;
    this.phoneUntil = now + 3000;
    this.mode = "phone";
    this.set(this.clips.phone, 7);
  }

  update(dtMs: number, now: number, releaseSlot: (n: Npc) => void) {
    if (this.mode === "phone" && now >= this.phoneUntil) {
      this.mode = "idle";
      this.set(this.clips.idle[this.dir], 6);
    }
    if (this.slot >= 0 && !this.goingHome && now >= this.meetUntil) {
      this.goingHome = true;
      this.target = { x: this.homeX, y: this.homeY };
      this.mode = "walk";
    }
    if (this.mode === "walk" && this.target) {
      const dx = this.target.x - this.sp.x;
      const dy = this.target.y - this.sp.y;
      const dist = Math.hypot(dx, dy);
      const step = (NPC_SPEED * dtMs) / 1000;
      if (dist <= step || dist < 1) {
        this.sp.x = this.target.x;
        this.sp.y = this.target.y;
        this.target = null;
        this.mode = "idle";
        if (this.goingHome) {
          releaseSlot(this);
          this.slot = -1;
          this.goingHome = false;
          this.dir = this.homeDir;
        }
        this.set(this.clips.idle[this.dir], 6);
      } else {
        this.dir = faceDir(dx, dy);
        this.sp.x += (dx / dist) * step;
        this.sp.y += (dy / dist) * step;
        this.set(this.clips.walk[this.dir], 10);
      }
    }
    this.ft += dtMs;
    const interval = 1000 / this.fps;
    while (this.ft >= interval) {
      this.ft -= interval;
      this.fi = (this.fi + 1) % this.cur.length;
    }
    const tex = this.cur[this.fi % this.cur.length];
    if (this.sp.texture !== tex) this.sp.texture = tex;
  }
}

export default function OfficeView() {
  const stageRef = useRef<HTMLDivElement>(null);
  const events = useEventStream("/api/events");
  const npcByDept = useRef(new Map<string, Npc[]>());
  const officeRef = useRef<{ layout: Layout; slotOwner: (Npc | null)[] } | null>(null);
  const [activeDepts, setActiveDepts] = useState<Set<string>>(new Set(DEFAULT_ACTIVE));
  const activeRef = useRef(activeDepts);
  activeRef.current = activeDepts;

  useEffect(() => {
    const host = stageRef.current;
    if (!host) return;
    const layout: Layout = LAYOUTS[DEFAULT_LAYOUT];
    const app = new Application();
    let destroyed = false;
    const keys = new Set<string>();
    const WASD = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (WASD.includes(k)) {
        keys.add(k);
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    const W = layout.w;
    const H = layout.h;
    const walkable: boolean[] = new Array(W * H).fill(true);
    const isWall: boolean[] = new Array(W * H).fill(false);
    const at = (x: number, y: number) => y * W + x;
    for (let x = 0; x < W; x++) {
      isWall[at(x, 0)] = isWall[at(x, H - 1)] = true;
      walkable[at(x, 0)] = walkable[at(x, H - 1)] = false;
    }
    for (let y = 0; y < H; y++) {
      isWall[at(0, y)] = isWall[at(W - 1, y)] = true;
      walkable[at(0, y)] = walkable[at(W - 1, y)] = false;
    }
    for (const room of layout.rooms) {
      if (!room.walled) continue;
      for (let x = room.x; x < room.x + room.w; x++)
        for (let y = room.y; y < room.y + room.h; y++) {
          const edge =
            x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
          if (edge) {
            isWall[at(x, y)] = true;
            walkable[at(x, y)] = false;
          }
        }
      for (const d of room.doors)
        for (let x = d.x; x < d.x + d.w; x++)
          for (let y = d.y; y < d.y + d.h; y++) {
            isWall[at(x, y)] = false;
            walkable[at(x, y)] = true;
          }
    }
    for (const f of layout.furniture) {
      const spec = FURNITURE[f.type];
      if (!spec || !spec.solid) continue;
      const [cw, ch] = spec.collide ?? [spec.w, spec.h];
      const baseY = f.y + spec.h - ch;
      for (let x = f.x; x < f.x + cw; x++)
        for (let y = baseY; y < baseY + ch; y++)
          if (x >= 0 && y >= 0 && x < W && y < H) walkable[at(x, y)] = false;
    }
    const canStand = (px: number, py: number) => {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
      return walkable[at(tx, ty)];
    };

    (async () => {
      await app.init({ resizeTo: host, backgroundColor: 0x0f0f17, antialias: false });
      if (destroyed) return;
      app.canvas.style.display = "block";
      host.appendChild(app.canvas);

      const world = new Container();
      world.scale.set(SCALE);
      app.stage.addChild(world);
      const floorLayer = new Container();
      const wallLayer = new Container();
      const furnLayer = new Container();
      const charLayer = new Container();
      world.addChild(floorLayer, wallLayer, furnLayer, charLayer);

      const floorTex: Record<string, Texture> = {};
      const floorFiles = new Set<string>([FLOORS.wood, WALL]);
      for (const r of layout.rooms) floorFiles.add(r.floor);
      for (const f of floorFiles) floorTex[f] = await Assets.load(tileUrl(f));
      if (destroyed) return;

      const baseFloor = new TilingSprite({
        texture: floorTex[FLOORS.wood],
        width: W * TILE,
        height: H * TILE,
      });
      floorLayer.addChild(baseFloor);
      for (const room of layout.rooms) {
        const rt = new TilingSprite({
          texture: floorTex[room.floor],
          width: room.w * TILE,
          height: room.h * TILE,
        });
        rt.x = room.x * TILE;
        rt.y = room.y * TILE;
        floorLayer.addChild(rt);
      }

      const wallTex = floorTex[WALL];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (isWall[at(x, y)]) {
            const s = new Sprite(wallTex);
            s.x = x * TILE;
            s.y = y * TILE;
            wallLayer.addChild(s);
          }

      const order = [...layout.furniture].sort(
        (a, b) => (FURNITURE[a.type]?.solid ? 1 : 0) - (FURNITURE[b.type]?.solid ? 1 : 0),
      );
      const furnCache: Record<string, Texture> = {};
      for (const f of order) {
        const spec = FURNITURE[f.type];
        if (!spec) continue;
        if (!furnCache[spec.file]) furnCache[spec.file] = await Assets.load(tileUrl(spec.file));
        if (destroyed) return;
        const s = new Sprite(furnCache[spec.file]);
        s.x = f.x * TILE;
        s.y = f.y * TILE;
        furnLayer.addChild(s);
      }

      const slice = async (b: Base, kind: string, n: number) => {
        const tex: Texture = await Assets.load(
          `/assets/modern-interiors/characters/${b}_${kind}_16x16.png`,
        );
        const out: Texture[] = [];
        for (let i = 0; i < n; i++)
          out.push(
            new Texture({
              source: tex.source,
              frame: new Rectangle(i * FRAME_W, 0, FRAME_W, FRAME_H),
            }),
          );
        return out;
      };
      const dirBlock = (a: Texture[], d: number) => a.slice(d * 6, d * 6 + 6);
      const clipsByBase: Record<string, Clips> = {};
      for (const b of ["Adam", "Alex", "Amelia", "Bob"] as Base[]) {
        const [idle, run, phone] = await Promise.all([
          slice(b, "idle_anim", 24),
          slice(b, "run", 24),
          slice(b, "phone", 9),
        ]);
        if (destroyed) return;
        clipsByBase[b] = {
          idle: [0, 1, 2, 3].map((d) => dirBlock(idle, d)),
          walk: [0, 1, 2, 3].map((d) => dirBlock(run, d)),
          phone,
        };
      }

      let byDept: Record<string, RoleInfo[]> = {};
      try {
        const res = await fetch("/api/roles");
        if (res.ok) byDept = ((await res.json()) as RolesResponse).byDept ?? {};
      } catch {
        /* keep empty → fall back to seat counts */
      }
      if (destroyed) return;

      const npcs: Npc[] = [];
      let seed = 0;
      for (const [dept, pod] of Object.entries(layout.pods)) {
        const roles = byDept[dept] ?? [];
        const count = Math.max(roles.length, DEPT_SEATS[dept] ?? 1);
        const seats = pod.seats.length >= count ? pod.seats : extendSeats(pod.seats, count);
        const style = DEPT_STYLE[dept] ?? { base: "Adam" as Base, tint: 0xffffff };
        const clips = clipsByBase[style.base];
        const list: Npc[] = [];
        for (let i = 0; i < count; i++) {
          const seat = seats[i];
          const sp = new Sprite(clips.idle[seat.dir][0]);
          sp.x = seat.x * TILE;
          sp.y = seat.y * TILE - TILE;
          sp.tint = style.tint;
          if (!activeRef.current.has(dept)) sp.alpha = 0.4;
          charLayer.addChild(sp);
          const npc = new Npc(
            sp,
            clips,
            seat.x * TILE,
            seat.y * TILE - TILE,
            seat.dir,
            (seed += 53) % 600,
          );
          npcs.push(npc);
          list.push(npc);
        }
        npcByDept.current.set(dept, list);
      }

      const pClips = clipsByBase.Amelia;
      const player = new Sprite(pClips.idle[0][0]);
      player.tint = 0x8affd6;
      let px = layout.playerStart.x * TILE + TILE / 2;
      let py = layout.playerStart.y * TILE + TILE / 2;
      let pfi = 0;
      let pft = 0;
      let pdir = 0;
      charLayer.addChild(player);

      const slotOwner: (Npc | null)[] = layout.councilSeats.map(() => null);
      const releaseSlot = (n: Npc) => {
        const i = slotOwner.indexOf(n);
        if (i >= 0) slotOwner[i] = null;
      };
      officeRef.current = { layout, slotOwner };

      app.ticker.add((tk) => {
        const now = performance.now();
        const dt = tk.deltaMS;
        let vx = 0;
        let vy = 0;
        if (keys.has("w") || keys.has("arrowup")) vy -= 1;
        if (keys.has("s") || keys.has("arrowdown")) vy += 1;
        if (keys.has("a") || keys.has("arrowleft")) vx -= 1;
        if (keys.has("d") || keys.has("arrowright")) vx += 1;
        const moving = vx !== 0 || vy !== 0;
        if (moving) {
          const m = Math.hypot(vx, vy) || 1;
          const step = (PLAYER_SPEED * dt) / 1000;
          const nx = px + (vx / m) * step;
          const ny = py + (vy / m) * step;
          if (canStand(nx, py)) px = nx;
          if (canStand(px, ny)) py = ny;
          pdir = faceDir(vx, vy);
        }
        player.x = px - TILE / 2;
        player.y = py - FRAME_H;
        const pf = moving ? pClips.walk[pdir] : pClips.idle[pdir];
        pft += dt;
        if (pft >= (moving ? 100 : 160)) {
          pft = 0;
          pfi = (pfi + 1) % pf.length;
        }
        const ptex = pf[pfi % pf.length];
        if (player.texture !== ptex) player.texture = ptex;

        for (const n of npcs) n.update(dt, now, releaseSlot);

        const vw = app.screen.width;
        const vh = app.screen.height;
        const worldW = W * TILE * SCALE;
        const worldH = H * TILE * SCALE;
        let ox = vw / 2 - px * SCALE;
        let oy = vh / 2 - py * SCALE;
        ox = worldW <= vw ? (vw - worldW) / 2 : Math.min(0, Math.max(vw - worldW, ox));
        oy = worldH <= vh ? (vh - worldH) / 2 : Math.min(0, Math.max(vh - worldH, oy));
        world.x = Math.round(ox);
        world.y = Math.round(oy);
      });
    })();

    return () => {
      destroyed = true;
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      app.destroy(true, { children: true });
      while (host.firstChild) host.removeChild(host.firstChild);
      npcByDept.current.clear();
      officeRef.current = null;
    };
  }, []);

  const lastHandled = useRef(0);
  useEffect(() => {
    const off = officeRef.current;
    if (!off) return;
    for (let i = lastHandled.current; i < events.length; i++) {
      const e = events[i];
      const dept = typeof e.dept === "string" ? e.dept : undefined;
      if (!dept) continue;
      if (!activeRef.current.has(dept))
        setActiveDepts((prev) => {
          if (prev.has(dept)) return prev;
          const next = new Set(prev);
          next.add(dept);
          return next;
        });
      const list = npcByDept.current.get(dept);
      if (!list || !list.length) continue;
      const ev = String(e.event ?? "");
      const now = performance.now();
      if (ev.startsWith("specialist")) {
        list[(i + list.length) % list.length]?.phone(now);
      } else {
        const lead = list[0];
        if (lead && lead.slot < 0) {
          const slot = off.slotOwner.findIndex((o) => o === null);
          if (slot >= 0) {
            off.slotOwner[slot] = lead;
            lead.toCouncil(off.layout.councilSeats[slot], slot, now);
          }
        }
      }
    }
    lastHandled.current = events.length;
  }, [events]);

  useEffect(() => {
    for (const [dept, list] of npcByDept.current.entries()) {
      const a = activeDepts.has(dept) ? 1 : 0.4;
      for (const n of list) n.sp.alpha = a;
    }
  }, [activeDepts]);

  const recent = useMemo(() => events.slice(-14).reverse(), [events]);
  const currentGate = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const m = /^g([1-5])\./.exec(String(events[i].event ?? ""));
      if (m) return `G${m[1]}`;
    }
    return null;
  }, [events]);
  const quotaTotal = useMemo(() => {
    let s = 0;
    for (const e of events) if (e.event === "quota.charge" && typeof e.frac === "number") s += e.frac;
    return s;
  }, [events]);
  const DEPTS = Object.keys(DEPT_STYLE);

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <div ref={stageRef} className="absolute inset-0 bg-neutral-950" />

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-black/70 px-3 py-2 text-[11px] ring-1 ring-white/10 backdrop-blur-md">
          <Link href="/" className="text-neutral-300 hover:text-white" title="back">
            ←
          </Link>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
          <span className="font-mono text-emerald-300/90">atelier://office</span>
          <span className="text-neutral-500">
            {activeDepts.size}/{DEPTS.length} depts active
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-black/70 px-3 py-2 font-mono text-[11px] ring-1 ring-white/10 backdrop-blur-md">
          <span>
            gate:{" "}
            <span className={currentGate ? "text-emerald-300" : "text-amber-300"}>
              {currentGate ?? "idle"}
            </span>
          </span>
          <span>
            quota:{" "}
            <span className="tabular-nums text-neutral-200">{(quotaTotal * 100).toFixed(1)}%</span>
          </span>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-3 left-3 z-10 rounded-lg bg-black/70 p-2 ring-1 ring-white/10 backdrop-blur-md">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-neutral-500">departments</div>
        <div className="grid grid-cols-3 gap-1">
          {DEPTS.map((d) => {
            const on = activeDepts.has(d);
            return (
              <div
                key={d}
                className={
                  "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ring-1 " +
                  (on
                    ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40"
                    : "bg-neutral-800/60 text-neutral-500 ring-white/10")
                }
              >
                <span
                  className={"h-1 w-1 rounded-full " + (on ? "bg-emerald-300 animate-pulse" : "bg-neutral-600")}
                />
                {d}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 text-[10px] text-neutral-500">
          <span className="font-mono text-emerald-300">WASD</span> / arrows to walk
        </div>
      </div>

      <aside className="absolute right-3 top-16 z-10 flex max-h-[calc(100vh-7rem)] w-[280px] flex-col rounded-xl border border-white/10 bg-neutral-950/85 backdrop-blur-md">
        <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300">
          live event log · <span className="font-mono text-neutral-500">{events.length}</span>
        </div>
        <div className="flex-1 space-y-1.5 overflow-auto p-2 font-mono text-[11px]" role="log" aria-live="polite">
          {recent.length === 0 ? (
            <div className="px-1 py-2 text-neutral-500">
              waiting for events…
              <div className="mt-1 text-neutral-600">
                run <code>atelier run …</code> — it appends to <code>runs/events.jsonl</code>
              </div>
            </div>
          ) : (
            recent.map((e, i) => (
              <div key={`${e.ts}-${i}`} className="rounded border border-white/10 bg-neutral-900/60 px-2 py-1">
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="truncate">{String(e.event)}</span>
                  <span className="tabular-nums text-neutral-600">
                    {new Date(e.ts as string).toLocaleTimeString()}
                  </span>
                </div>
                {typeof e.dept === "string" && <span className="text-amber-300/90">{e.dept}</span>}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function extendSeats(seats: Seat[], count: number): Seat[] {
  const out = [...seats];
  if (!out.length) return out;
  const perRow = 4;
  const first = out[0];
  let i = out.length;
  while (out.length < count) {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    out.push({ x: first.x + col * 3, y: first.y + row * 4, dir: 0 });
    i++;
  }
  return out;
}
