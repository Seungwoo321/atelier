// Furniture / tile catalog. Each piece is a real sprite extracted from the
// Modern Interiors atlas by scripts/extract_office_tiles.py into
// /office/tiles/<name>.png. Sizes are in 16px tiles.
//
// solid:   blocks movement over its collision footprint.
// collide: [w,h] collision box anchored at the sprite's BOTTOM-left, in tiles.
//          Defaults to the full footprint when omitted. Tall props (plants,
//          bookshelves) only block their base so you can stand "behind" them.

export const TILE = 16;

export type FurnSpec = {
  file: string;
  w: number; // tiles
  h: number; // tiles
  solid: boolean;
  collide?: [number, number]; // base collision box (w,h) from bottom-left
};

export const FURNITURE: Record<string, FurnSpec> = {
  table_light: { file: "table_light", w: 3, h: 3, solid: true },
  bookshelf: { file: "bookshelf", w: 3, h: 5, solid: true, collide: [3, 1] },
  sofa_pink: { file: "sofa_pink", w: 2, h: 2, solid: true, collide: [2, 1] },
  plant_palm: { file: "plant_palm", w: 1, h: 3, solid: true, collide: [1, 1] },
  plant_small: { file: "plant_small", w: 1, h: 2, solid: true, collide: [1, 1] },
  plant_pot: { file: "plant_pot", w: 1, h: 2, solid: true, collide: [1, 1] },
  fridge_glass: { file: "fridge_glass", w: 1, h: 3, solid: true, collide: [1, 1] },
  board_dark: { file: "board_dark", w: 2, h: 2, solid: false }, // wall-mounted whiteboard
  rug_red: { file: "rug_red", w: 3, h: 2, solid: false },
  chair_wood: { file: "chair_wood", w: 1, h: 2, solid: false }, // seats; agents stand on them
  counter_wood: { file: "counter_wood", w: 3, h: 1, solid: true },
  wardrobe: { file: "wardrobe", w: 2, h: 3, solid: true, collide: [2, 1] },
};

// Only floor_warm (wood) and floor_wood_b (light grey gradient) extracted cleanly,
// so every floor maps onto one of those two; per-room variety comes from tint.
export const FLOORS = {
  wood: "floor_warm",
  woodAlt: "floor_warm",
  tile: "floor_wood_b",
  tileGrey: "floor_wood_b",
  warm: "floor_warm",
} as const;

export const WALL = "wall_front_a";

export function tileUrl(name: string): string {
  return `/office/tiles/${name}.png`;
}
