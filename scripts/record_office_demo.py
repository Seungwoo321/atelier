"""Record an open-world /office walk to docs/office-demo.gif.

Drives a headless Chromium with playwright, dispatches keyboard events
that move the avatar Engineering → Council, then converts the captured
webm to a paletted gif at 12 fps.
"""

from __future__ import annotations

import asyncio
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
TMP = ROOT / "build" / "office-demo"
GIF_OUT = DOCS / "office-demo.gif"
URL = "http://localhost:3000/office"


async def drive(page) -> None:
    await page.goto(URL)
    await page.wait_for_timeout(2500)
    moves = [
        (("ArrowDown",), 1400),
        (("ArrowRight",), 900),
        (("ArrowDown", "ArrowLeft"), 1200),
        (("ArrowDown",), 1300),
        ((), 400),
    ]
    for keys, dur in moves:
        for k in keys:
            await page.keyboard.down(k)
        await page.wait_for_timeout(dur)
        for k in keys:
            await page.keyboard.up(k)


async def main() -> None:
    if TMP.exists():
        shutil.rmtree(TMP)
    TMP.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_dir=str(TMP),
            record_video_size={"width": 1280, "height": 720},
        )
        page = await context.new_page()
        await drive(page)
        await page.close()
        await context.close()
        await browser.close()

    webms = sorted(TMP.glob("*.webm"))
    if not webms:
        print("ERROR: no video captured", file=sys.stderr)
        sys.exit(1)
    src = webms[-1]
    palette = TMP / "palette.png"
    vf = "fps=10,scale=640:-1:flags=lanczos"
    subprocess.check_call([
        "ffmpeg", "-y", "-i", str(src),
        "-vf", f"{vf},palettegen=max_colors=64",
        str(palette),
    ])
    subprocess.check_call([
        "ffmpeg", "-y", "-i", str(src), "-i", str(palette),
        "-lavfi", f"{vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5",
        str(GIF_OUT),
    ])
    size = GIF_OUT.stat().st_size / 1024
    print(f"wrote {GIF_OUT} ({size:.0f} KB)")


if __name__ == "__main__":
    t0 = time.time()
    asyncio.run(main())
    print(f"done in {time.time() - t0:.1f}s")
