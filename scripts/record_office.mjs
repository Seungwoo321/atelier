import { chromium } from "/Users/mzc02-swlee/atelier/web/node_modules/playwright/index.mjs";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EVENTS = path.join(ROOT, "runs/events.jsonl");
const OUT_DIR = path.join(ROOT, "docs/office-frames");

const FRAMES = 14;
const FRAME_MS = 700;

const driverEvents = [
  null,
  { event: "g3.design.judge", dept: "Design", score: 9.1 },
  null,
  { event: "quota.charge", dept: "Engineering", frac: 0.018 },
  null,
  { event: "g4.review.judge", dept: "Engineering", score: 9.3 },
  null,
  { event: "quota.charge", dept: "Marketing", frac: 0.012 },
  null,
  { event: "council.cross.dept", dept: "Operations" },
  null,
  { event: "g5.launch.dryrun", dept: "Marketing", role: "Mkt Lead" },
  null,
  null,
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 600 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/office", { waitUntil: "domcontentloaded" });
await page.waitForSelector("canvas", { timeout: 15000 });
await page.waitForTimeout(2500);

const canvasBox = await page.locator(".overflow-hidden.rounded-xl > div").first().boundingBox();
const aside = await page.locator("aside").first().boundingBox();
const clip = canvasBox && aside ? {
  x: Math.floor(Math.min(canvasBox.x, aside.x)) - 4,
  y: Math.floor(canvasBox.y) - 4,
  width: Math.ceil((aside.x + aside.width) - canvasBox.x) + 8,
  height: Math.ceil(Math.max(canvasBox.height, aside.height)) + 8,
} : undefined;

import { mkdirSync, rmSync } from "node:fs";
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

for (let i = 0; i < FRAMES; i++) {
  const ev = driverEvents[i];
  if (ev) {
    const ts = new Date().toISOString().replace(/\.\d{3}Z$/, "");
    appendFileSync(EVENTS, JSON.stringify({ ts, ...ev }) + "\n");
  }
  await page.waitForTimeout(FRAME_MS);
  const frame = String(i).padStart(3, "0");
  await page.screenshot({
    path: path.join(OUT_DIR, `f${frame}.png`),
    clip,
  });
  process.stdout.write(`captured f${frame}\n`);
}

await browser.close();
console.log(`wrote ${FRAMES} frames to ${OUT_DIR}`);
