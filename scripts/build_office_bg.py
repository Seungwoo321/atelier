"""Compose the Atelier open-world office floor plan.

A 3-by-3 grid of department rooms sits above a full-width Cross-Dept Council
hall, all linked by corridors. The user's avatar walks the world in /office;
the PixiJS view pans/zooms over it. Output is served as /office-bg.png.

Floors and walls are drawn procedurally so the Modern Interiors atlas swap
can never break the tile coordinates. The atlas is still the source of truth
for the characters that walk on top.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web/public/office-bg.png"

WORLD_W = 1920
WORLD_H = 1600

ROOM_W = 480
ROOM_H = 320
ROOM_GAP_X = 60
ROOM_GAP_Y = 60
COUNCIL_H = 280
COUNCIL_GAP = 80

MARGIN_X = (WORLD_W - 3 * ROOM_W - 2 * ROOM_GAP_X) // 2
MARGIN_Y = (WORLD_H - (3 * ROOM_H + 2 * ROOM_GAP_Y + COUNCIL_GAP + COUNCIL_H)) // 2

WALL_THICK = 8

ROOMS = [
    ("Chief",       0, 0, (210, 200, 230)),
    ("Strategy",    1, 0, (235, 215, 175)),
    ("Product",     2, 0, (215, 230, 200)),
    ("Design",      0, 1, (230, 200, 215)),
    ("Engineering", 1, 1, (210, 220, 235)),
    ("QA",          2, 1, (200, 225, 230)),
    ("Marketing",   0, 2, (235, 210, 200)),
    ("Operations",  1, 2, (225, 220, 200)),
    ("Analytics",   2, 2, (210, 225, 220)),
]

CORRIDOR_FILL = (88, 76, 60)
GROUND_FILL = (52, 44, 36)
WALL_FILL = (38, 30, 24)
WALL_HIGHLIGHT = (74, 60, 46)
COUNCIL_FLOOR = (190, 215, 220)


def room_rect(col: int, row: int) -> tuple[int, int, int, int]:
    x = MARGIN_X + col * (ROOM_W + ROOM_GAP_X)
    y = MARGIN_Y + row * (ROOM_H + ROOM_GAP_Y)
    return x, y, x + ROOM_W, y + ROOM_H


def council_rect() -> tuple[int, int, int, int]:
    x0 = MARGIN_X
    x1 = MARGIN_X + 3 * ROOM_W + 2 * ROOM_GAP_X
    y0 = MARGIN_Y + 3 * ROOM_H + 2 * ROOM_GAP_Y + COUNCIL_GAP
    y1 = y0 + COUNCIL_H
    return x0, y0, x1, y1


def speckle(draw: ImageDraw.ImageDraw, rect: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = rect
    for y in range(y0, y1, 16):
        for x in range(x0, x1, 16):
            draw.point((x + 4, y + 6), fill=(255, 255, 255, 40))
            draw.point((x + 11, y + 12), fill=(0, 0, 0, 25))


def draw_walls(draw: ImageDraw.ImageDraw, rect: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = rect
    draw.rectangle([x0, y0, x1, y0 + WALL_THICK], fill=WALL_FILL + (255,))
    draw.rectangle([x0, y1 - WALL_THICK, x1, y1], fill=WALL_FILL + (255,))
    draw.rectangle([x0, y0, x0 + WALL_THICK, y1], fill=WALL_FILL + (255,))
    draw.rectangle([x1 - WALL_THICK, y0, x1, y1], fill=WALL_FILL + (255,))
    draw.rectangle([x0, y0, x1, y0 + 2], fill=WALL_HIGHLIGHT + (255,))


def draw_room(draw: ImageDraw.ImageDraw, rect: tuple[int, int, int, int], color: tuple[int, int, int]) -> None:
    draw.rectangle(rect, fill=color + (255,))
    speckle(draw, rect)
    draw_walls(draw, rect)


def door_gap(draw: ImageDraw.ImageDraw, x0: int, y0: int, w: int, h: int, color: tuple[int, int, int]) -> None:
    draw.rectangle([x0, y0, x0 + w, y0 + h], fill=color + (255,))


def desk(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    w, h = 96, 44
    x, y = cx - w // 2, cy - h // 2
    draw.rectangle([x, y, x + w, y + h], fill=(74, 56, 42, 255), outline=(34, 24, 16, 255))
    draw.rectangle([x + 3, y + 3, x + w - 3, y + h - 3], fill=(110, 84, 62, 255))
    draw.rectangle([x + 10, y + 6, x + 36, y + h - 14], fill=(20, 24, 30, 255), outline=(8, 10, 14, 255))
    draw.rectangle([x + 12, y + 8, x + 34, y + h - 16], fill=(80, 140, 200, 255))
    draw.rectangle([x + w - 36, y + 9, x + w - 12, y + h - 15], fill=(180, 180, 190, 255), outline=(40, 40, 48, 255))
    draw.rectangle([x + w - 34, y + 11, x + w - 14, y + h - 17], fill=(60, 80, 110, 255))


def meeting_table(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    w, h = 420, 120
    x, y = cx - w // 2, cy - h // 2
    draw.rounded_rectangle([x, y, x + w, y + h], radius=18, fill=(86, 64, 46, 255), outline=(34, 24, 16, 255), width=2)
    draw.rounded_rectangle([x + 8, y + 8, x + w - 8, y + h - 8], radius=12, fill=(120, 92, 68, 255))
    for i in range(10):
        cx2 = x + 22 + i * ((w - 44) // 9)
        draw.ellipse([cx2 - 8, y - 18, cx2 + 8, y - 2], fill=(50, 50, 56, 255), outline=(20, 20, 24, 255))
        draw.ellipse([cx2 - 8, y + h + 2, cx2 + 8, y + h + 18], fill=(50, 50, 56, 255), outline=(20, 20, 24, 255))


def plant(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    draw.rectangle([cx - 8, cy + 4, cx + 8, cy + 18], fill=(110, 64, 38, 255), outline=(40, 24, 14, 255))
    draw.ellipse([cx - 16, cy - 14, cx + 16, cy + 8], fill=(70, 120, 60, 255), outline=(30, 60, 28, 255))
    draw.ellipse([cx - 10, cy - 20, cx + 10, cy], fill=(90, 150, 70, 255))


def label(draw: ImageDraw.ImageDraw, text: str, rect: tuple[int, int, int, int], font: ImageFont.FreeTypeFont | ImageFont.ImageFont) -> None:
    x0, y0, _, _ = rect
    tw = draw.textlength(text, font=font)
    pad = 6
    bx0 = x0 + 14
    by0 = y0 + 14
    bx1 = bx0 + int(tw) + pad * 2
    by1 = by0 + 22
    draw.rounded_rectangle([bx0, by0, bx1, by1], radius=6, fill=(0, 0, 0, 170))
    draw.text((bx0 + pad, by0 + 4), text, fill=(245, 240, 230, 255), font=font)


def main() -> None:
    img = Image.new("RGBA", (WORLD_W, WORLD_H), GROUND_FILL + (255,))
    draw = ImageDraw.Draw(img)

    for cy in range(0, WORLD_H, 32):
        draw.line([(0, cy), (WORLD_W, cy)], fill=(0, 0, 0, 25))
    for cx in range(0, WORLD_W, 32):
        draw.line([(cx, 0), (cx, WORLD_H)], fill=(0, 0, 0, 25))

    # Department-to-department corridors inside the 3x3 grid.
    for col in range(3):
        for row in range(3):
            rx0, ry0, rx1, ry1 = room_rect(col, row)
            if col < 2:
                cx0 = rx1
                cx1 = rx1 + ROOM_GAP_X
                ccy = ry0 + ROOM_H // 2 - 28
                draw.rectangle([cx0, ccy, cx1, ccy + 56], fill=CORRIDOR_FILL + (255,))
                draw.line([(cx0, ccy), (cx1, ccy)], fill=WALL_FILL + (255,))
                draw.line([(cx0, ccy + 56), (cx1, ccy + 56)], fill=WALL_FILL + (255,))
            if row < 2:
                cy0 = ry1
                cy1 = ry1 + ROOM_GAP_Y
                ccx = rx0 + ROOM_W // 2 - 28
                draw.rectangle([ccx, cy0, ccx + 56, cy1], fill=CORRIDOR_FILL + (255,))
                draw.line([(ccx, cy0), (ccx, cy1)], fill=WALL_FILL + (255,))
                draw.line([(ccx + 56, cy0), (ccx + 56, cy1)], fill=WALL_FILL + (255,))

    # Grid → Council connector corridors (drop from bottom of row 2 rooms).
    council_x0, council_y0, council_x1, council_y1 = council_rect()
    for col in range(3):
        rx0, _, _, ry1 = room_rect(col, 2)
        cx_center = rx0 + ROOM_W // 2
        cor_x0 = cx_center - 28
        cor_x1 = cx_center + 28
        draw.rectangle([cor_x0, ry1, cor_x1, council_y0], fill=CORRIDOR_FILL + (255,))
        draw.line([(cor_x0, ry1), (cor_x0, council_y0)], fill=WALL_FILL + (255,))
        draw.line([(cor_x1, ry1), (cor_x1, council_y0)], fill=WALL_FILL + (255,))

    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 18)
        big_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)
    except OSError:
        font = ImageFont.load_default()
        big_font = font

    # 3x3 dept rooms.
    for name, col, row, color in ROOMS:
        rect = room_rect(col, row)
        draw_room(draw, rect, color)
        if col < 2:
            door_gap(draw, rect[2] - WALL_THICK, rect[1] + ROOM_H // 2 - 24, WALL_THICK, 48, color)
        if col > 0:
            door_gap(draw, rect[0], rect[1] + ROOM_H // 2 - 24, WALL_THICK, 48, color)
        if row < 2:
            door_gap(draw, rect[0] + ROOM_W // 2 - 24, rect[3] - WALL_THICK, 48, WALL_THICK, color)
        if row > 0:
            door_gap(draw, rect[0] + ROOM_W // 2 - 24, rect[1], 48, WALL_THICK, color)
        if row == 2:
            door_gap(draw, rect[0] + ROOM_W // 2 - 24, rect[3] - WALL_THICK, 48, WALL_THICK, color)
        label(draw, name, rect, font)

    # Council hall (full-width).
    council = council_rect()
    draw.rectangle(council, fill=COUNCIL_FLOOR + (255,))
    speckle(draw, council)
    draw_walls(draw, council)
    # Door gaps on the top edge under each grid column.
    for col in range(3):
        rx0, _, _, _ = room_rect(col, 2)
        cx_center = rx0 + ROOM_W // 2
        door_gap(draw, cx_center - 24, council[1], 48, WALL_THICK, COUNCIL_FLOOR)
    label(draw, "Cross-Dept Council", council, big_font)

    # Furniture.
    for name, col, row, _ in ROOMS:
        x0, y0, x1, y1 = room_rect(col, row)
        cx = (x0 + x1) // 2
        cy = (y0 + y1) // 2
        desk(draw, cx, cy + 8)
        plant(draw, x1 - 40, y0 + 50)

    cx0, cy0, cx1, cy1 = council
    ccx = (cx0 + cx1) // 2
    ccy = (cy0 + cy1) // 2
    meeting_table(draw, ccx, ccy)
    plant(draw, cx0 + 60, cy0 + 80)
    plant(draw, cx1 - 60, cy0 + 80)
    plant(draw, cx0 + 60, cy1 - 60)
    plant(draw, cx1 - 60, cy1 - 60)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(f"wrote {OUT} {img.size}")


if __name__ == "__main__":
    main()
