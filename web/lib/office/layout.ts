// Data-driven office floor plan. Everything here is in 16px tiles and is meant
// to be edited / swapped: add a Layout to LAYOUTS and the renderer picks it up.
//
// Model: an open-plan floor (walkable everywhere inside the outer wall) with
//  - dept "pods": open zones (no walls) marked by a rug + furniture + a desk
//    run that seats the lead and that dept's specialists.
//  - enclosed rooms (Council / Kitchen / Phone) with walls + a door gap.
// Collision is derived from walls + solid furniture in OfficeView.

import { FLOORS } from "./tiles";

export type Dir = 0 | 1 | 2 | 3; // down, up, left, right

export type Seat = { x: number; y: number; dir: Dir };
export type FurnInst = { type: string; x: number; y: number };
export type Door = { x: number; y: number; w: number; h: number };

export type Room = {
  id: string;
  kind: "pod" | "council" | "kitchen" | "phone";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: string; // floor tile file
  walled: boolean;
  doors: Door[];
};

export type Pod = {
  dept: string;
  label: string;
  seats: Seat[]; // [0] = lead seat, rest = specialists
};

export type Layout = {
  name: string;
  w: number; // tiles
  h: number; // tiles
  rooms: Room[];
  furniture: FurnInst[];
  pods: Record<string, Pod>;
  councilSeats: Seat[]; // where leads gather during a council
  playerStart: { x: number; y: number };
};

// Department roster sizes (lead + specialists) — mirrors atelier/roles.
// Used to lay out enough desk seats per pod.
export const DEPT_SEATS: Record<string, number> = {
  Chief: 3, // Chief of Staff + Memory Keeper + Eval Officer
  Strategy: 4,
  Product: 3,
  Design: 4,
  Engineering: 8,
  QA: 3,
  Marketing: 5,
  Operations: 3,
  Analytics: 3,
};

// ---- default layout: "Atelier HQ" open-plan, 3x3 pod grid + center council ----

const CELL_W = 19;
const CELL_H = 13;
const ORIGIN_X = 2;
const ORIGIN_Y = 2;

type Cell = { col: number; row: number };
const DEPT_CELLS: Record<string, Cell> = {
  Strategy: { col: 0, row: 0 },
  Product: { col: 1, row: 0 },
  Design: { col: 2, row: 0 },
  Engineering: { col: 0, row: 1 },
  Chief: { col: 1, row: 1 }, // center = council host
  QA: { col: 2, row: 1 },
  Marketing: { col: 0, row: 2 },
  Operations: { col: 1, row: 2 },
  Analytics: { col: 2, row: 2 },
};

const POD_FLOORS: Record<string, string> = {
  Strategy: FLOORS.wood,
  Product: FLOORS.wood,
  Design: FLOORS.warm,
  Engineering: FLOORS.tileGrey,
  QA: FLOORS.tile,
  Marketing: FLOORS.warm,
  Operations: FLOORS.tile,
  Analytics: FLOORS.tileGrey,
};

function cellOrigin(c: Cell): { x: number; y: number } {
  return { x: ORIGIN_X + c.col * CELL_W, y: ORIGIN_Y + c.row * CELL_H };
}

// Lay out N desk seats in rows of `perRow` desks within a pod zone.
function podSeats(ox: number, oy: number, n: number): Seat[] {
  const seats: Seat[] = [];
  const perRow = 4;
  const sx = ox + 2;
  const sy = oy + 3;
  for (let i = 0; i < n; i++) {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    seats.push({ x: sx + col * 3, y: sy + row * 4, dir: 0 });
  }
  return seats;
}

function buildAtelierHQ(): Layout {
  const w = ORIGIN_X * 2 + CELL_W * 3;
  const h = ORIGIN_Y * 2 + CELL_H * 3;
  const rooms: Room[] = [];
  const furniture: FurnInst[] = [];
  const pods: Record<string, Pod> = {};

  for (const [dept, cell] of Object.entries(DEPT_CELLS)) {
    const o = cellOrigin(cell);
    const isChief = dept === "Chief";
    const podW = CELL_W - 3;
    const podH = CELL_H - 3;

    if (isChief) {
      // central enclosed Council room with a door on the bottom edge
      rooms.push({
        id: "Council",
        kind: "council",
        label: "Cross-Dept Council",
        x: o.x,
        y: o.y,
        w: podW + 2,
        h: podH + 2,
        floor: FLOORS.warm,
        walled: true,
        doors: [{ x: o.x + Math.floor((podW + 2) / 2) - 1, y: o.y + podH + 1, w: 2, h: 1 }],
      });
      // council meeting table + chairs
      furniture.push({ type: "table_light", x: o.x + Math.floor(podW / 2) - 1, y: o.y + 3 });
      furniture.push({ type: "plant_palm", x: o.x + 1, y: o.y + 1 });
      furniture.push({ type: "plant_palm", x: o.x + podW, y: o.y + 1 });
      furniture.push({ type: "board_dark", x: o.x + Math.floor(podW / 2) - 1, y: o.y + 1 });
    } else {
      rooms.push({
        id: dept,
        kind: "pod",
        label: dept,
        x: o.x,
        y: o.y,
        w: podW,
        h: podH,
        floor: POD_FLOORS[dept] ?? FLOORS.wood,
        walled: false,
        doors: [],
      });
      // pod furniture: a rug, a desk run, a plant, a bookshelf/sofa accent
      furniture.push({ type: "rug_red", x: o.x + 1, y: o.y + 1 });
      furniture.push({ type: "counter_wood", x: o.x + 1, y: o.y + 2 });
      furniture.push({ type: "counter_wood", x: o.x + 4, y: o.y + 2 });
      furniture.push({ type: "plant_palm", x: o.x + podW - 1, y: o.y });
      if (cell.row === 0) furniture.push({ type: "bookshelf", x: o.x + podW - 4, y: o.y });
      else furniture.push({ type: "sofa_pink", x: o.x + podW - 3, y: o.y + podH - 2 });
      furniture.push({ type: "plant_pot", x: o.x, y: o.y + podH - 2 });
    }

    const seats = podSeats(o.x, o.y, DEPT_SEATS[dept] ?? 3);
    // chairs under each seat for flavor
    for (const s of seats) furniture.push({ type: "chair_wood", x: s.x, y: s.y });
    pods[dept] = { dept, label: dept, seats };
  }

  // council gathering slots (around the central table)
  const cc = cellOrigin(DEPT_CELLS.Chief);
  const cx = cc.x + Math.floor((CELL_W - 3) / 2);
  const cy = cc.y + 4;
  const councilSeats: Seat[] = [
    { x: cx - 3, y: cy, dir: 3 },
    { x: cx + 3, y: cy, dir: 2 },
    { x: cx - 3, y: cy + 3, dir: 3 },
    { x: cx + 3, y: cy + 3, dir: 2 },
    { x: cx - 1, y: cy + 4, dir: 1 },
    { x: cx + 1, y: cy + 4, dir: 1 },
    { x: cx - 1, y: cy - 2, dir: 0 },
    { x: cx + 1, y: cy - 2, dir: 0 },
  ];

  return {
    name: "Atelier HQ",
    w,
    h,
    rooms,
    furniture,
    pods,
    councilSeats,
    playerStart: { x: cx, y: h - 4 },
  };
}

export const LAYOUTS: Record<string, Layout> = {
  atelierHQ: buildAtelierHQ(),
};

export const DEFAULT_LAYOUT = "atelierHQ";
