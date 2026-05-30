"""Extract office floor/wall/furniture sprites from the Modern Interiors atlas.

The LimeZu pack ships no per-object index, so we cherry-pick tile rects from the
two source sheets by (col,row,w,h) and emit one transparent PNG per piece plus a
single labeled montage for visual verification. Coordinates were read off
high-zoom grid renders of the sheets.

Output: web/public/office/tiles/<name>.png  +  /tmp/ex_montage.png (verify only)
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets/modern-interiors/interiors/16x16"
ROOM = Image.open(ASSETS / "Room_Builder_16x16.png").convert("RGBA")
INT = Image.open(ASSETS / "Interiors_16x16.png").convert("RGBA")
OUT = ROOT / "web/public/office/tiles"
OUT.mkdir(parents=True, exist_ok=True)
T = 16

# name -> (sheet, col, row, w, h)  — w,h in tiles
PIECES: dict[str, tuple[Image.Image, int, int, int, int]] = {
    # --- Room_Builder: floor candidates (single tiles) ---
    "floor_wood_a": (ROOM, 1, 13, 1, 1),
    "floor_wood_b": (ROOM, 6, 13, 1, 1),
    "floor_tile_grey": (ROOM, 1, 9, 1, 1),
    "floor_tile_light": (ROOM, 6, 9, 1, 1),
    "floor_warm": (ROOM, 11, 13, 1, 1),
    # --- Room_Builder: wall candidates ---
    "wall_front_a": (ROOM, 1, 3, 1, 1),
    "wall_front_b": (ROOM, 1, 2, 1, 1),
    "wall_top": (ROOM, 1, 1, 1, 1),
    # --- Interiors: furniture (col,row,w,h) read off band renders ---
    "table_light": (INT, 6, 10, 3, 3),
    "bookshelf": (INT, 5, 13, 3, 5),
    "sofa_pink": (INT, 8, 18, 2, 2),
    "plant_palm": (INT, 12, 26, 1, 3),
    "plant_small": (INT, 10, 26, 1, 2),
    "plant_pot": (INT, 0, 31, 1, 2),
    "fridge_glass": (INT, 1, 18, 1, 3),
    "board_dark": (INT, 0, 14, 2, 2),
    "rug_red": (INT, 8, 16, 3, 2),
    "chair_wood": (INT, 4, 21, 1, 2),
    "counter_wood": (INT, 1, 40, 3, 1),
    "wardrobe": (INT, 7, 30, 2, 3),
}


def crop(sheet: Image.Image, c: int, r: int, w: int, h: int) -> Image.Image:
    return sheet.crop((c * T, r * T, (c + w) * T, (r + h) * T))


def main() -> None:
    pieces = {}
    for name, (sheet, c, r, w, h) in PIECES.items():
        img = crop(sheet, c, r, w, h)
        img.save(OUT / f"{name}.png")
        pieces[name] = img

    # montage: enlarge each piece, label name + size
    cols = 6
    cell = 150
    rows = (len(pieces) + cols - 1) // cols
    cv = Image.new("RGBA", (cols * cell, rows * cell), (30, 30, 40, 255))
    d = ImageDraw.Draw(cv)
    for i, (name, img) in enumerate(pieces.items()):
        gx, gy = (i % cols) * cell, (i // cols) * cell
        w, h = img.size
        sc = min((cell - 36) / w, (cell - 36) / h, 8)
        thumb = img.resize((max(1, int(w * sc)), max(1, int(h * sc))), Image.NEAREST)
        cv.alpha_composite(thumb, (gx + (cell - thumb.size[0]) // 2,
                                   gy + 20 + (cell - 20 - thumb.size[1]) // 2))
        d.text((gx + 3, gy + 3), f"{name}", fill=(255, 220, 120, 255))
        d.text((gx + 3, gy + cell - 12), f"{w//T}x{h//T}t", fill=(150, 200, 255, 255))
        d.rectangle([gx, gy, gx + cell - 1, gy + cell - 1], outline=(70, 70, 90, 255))
    cv.convert("RGB").save("/tmp/ex_montage.png")
    print(f"extracted {len(pieces)} pieces -> {OUT}")
    print(f"montage -> /tmp/ex_montage.png {cv.size}")


if __name__ == "__main__":
    main()
