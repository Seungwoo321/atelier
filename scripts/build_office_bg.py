"""Compose a clean top-down office background at 960x540.

The Modern Interiors Room_Builder atlas is editor-oriented (has baked-in
"room border / ceiling" annotation text), so we cherry-pick only the pure
floor/wall cells and assemble them ourselves, then layer procedural desks
on top to suggest an office floor plan.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ROOM = ROOT / "assets/modern-interiors/interiors/16x16/Room_Builder_free_16x16.png"
OUT = ROOT / "web/public/office-bg.png"

TILE = 16
SCALE = 2
COLS = 30
ROWS = 17

FLOOR_CELL = (12, 11)   # clean grey stone, no skirting
RUG_CELL = (12, 9)      # teal pattern for meeting area accent


def cell(atlas: Image.Image, col: int, row: int) -> Image.Image:
    return atlas.crop((col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE))


def desk(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    draw.rectangle([x, y, x + w, y + h], fill=(74, 56, 42, 255), outline=(34, 24, 16, 255))
    draw.rectangle([x + 2, y + 2, x + w - 2, y + h - 2], fill=(102, 78, 58, 255))
    # monitor on left side of desk
    mx, my = x + 10, y + 4
    draw.rectangle([mx, my, mx + 22, my + h - 12], fill=(20, 24, 30, 255), outline=(8, 10, 14, 255))
    draw.rectangle([mx + 2, my + 2, mx + 20, my + h - 14], fill=(80, 140, 200, 255))
    draw.rectangle([mx + 4, my + h - 14, mx + 18, my + h - 12], fill=(40, 40, 48, 255))
    # laptop on right side
    lx, ly = x + w - 32, y + 8
    draw.rectangle([lx, ly, lx + 22, ly + h - 16], fill=(180, 180, 190, 255), outline=(40, 40, 48, 255))
    draw.rectangle([lx + 2, ly + 2, lx + 20, ly + h - 18], fill=(60, 80, 110, 255))


def main() -> None:
    atlas = Image.open(ROOM).convert("RGBA")
    floor = cell(atlas, *FLOOR_CELL)
    rug = cell(atlas, *RUG_CELL)

    w_native = COLS * TILE
    h_native = ROWS * TILE
    bg = Image.new("RGBA", (w_native, h_native), (24, 28, 36, 255))

    # tile the floor across the whole canvas
    for r in range(ROWS):
        for c in range(COLS):
            bg.paste(floor, (c * TILE, r * TILE), floor)

    # meeting-area rug: 6x4 patch on the right
    for r in range(2, 6):
        for c in range(COLS - 8, COLS - 2):
            bg.paste(rug, (c * TILE, r * TILE), rug)

    # top wall band — 2 rows of darker fill for ceiling separation
    overlay = Image.new("RGBA", (w_native, TILE * 2), (32, 28, 40, 220))
    bg.paste(overlay, (0, 0), overlay)

    # left/right edge wall hint
    side = Image.new("RGBA", (TILE, h_native), (0, 0, 0, 90))
    bg.paste(side, (0, 0), side)
    bg.paste(side, (w_native - TILE, 0), side)

    # upscale crisply
    final = bg.resize((w_native * SCALE, h_native * SCALE), Image.NEAREST).crop((0, 0, 960, 540))

    # 9 desk rectangles aligned with character positions defined in OfficeView.tsx
    desk_positions = [
        (80, 130), (288, 130), (496, 130),
        (80, 262), (288, 262), (496, 262),
        (80, 394), (288, 394), (496, 394),
    ]
    draw = ImageDraw.Draw(final)
    desk_w, desk_h = 104, 36
    for sx, sy in desk_positions:
        x = sx - 12
        y = sy + 70
        desk(draw, x, y, desk_w, desk_h)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    final.save(OUT)
    print(f"wrote {OUT} {final.size}")


if __name__ == "__main__":
    main()
