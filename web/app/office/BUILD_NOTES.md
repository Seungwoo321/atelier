<!-- Scratch notes for the office rebuild. Delete before merging. -->
# Office rebuild — working notes

## Confirmed direction (locked with user)
- **Dogfood = real data + real run.** Office must render the REAL org (36 agents) and be
  driven by real `atelier start` events (runs/events.jsonl via SSE), not mock data.
  Run atelier once to prove end-to-end. Dynamic dept activation by phase —
  current phase = planning/design/dev → **Strategy, Product, Design, Engineering** active;
  Marketing/Operations/Analytics dimmed/idle.
- **Open-plan tech-startup floor**: dept pods + central Council/Lounge + Kitchen + Phone room.
  Camera zoom so ~1 pod fills the screen. One floor.
- Furniture from the **Interiors tileset** + **solid collision** (no walking through objects).
- **Editable, data-driven layouts** (rooms/furniture/doors/collision in a data file) + a default.
- Place **all 36 agents** (9 leads + 27 specialists) in their dept pods, full animation.
- **Fix down-arrow facing bug.**

## Org (from atelier/roles) — 9 leads + 27 specialists = 36
Chief(2 spec: Memory Keeper, Eval Officer) · Strategy(3) · Product(2) · Design(3) ·
Engineering(7) · QA(2) · Marketing(4) · Operations(2) · Analytics(2).
Web reads `/api/roles` (byDept) and `/api/events` (SSE, last 50) via lib/useEventStream.ts.

## Assets (assets/modern-interiors, mirrored to web/public/assets)
- characters/: Adam, Alex, Amelia, Bob = FULL anim (idle, idle_anim, phone, run, sit, sit2, sit3).
  Bruce, Conference_man, Dan, Edward, Lucy = idle-only.
- Sheets: idle 64x32 (4 frames). idle_anim/run/sit 384x32 (24 = 4 dir blocks x 6). phone 144x32 (9).
  sit2/sit3 192x32 (12). Frame = 16x32.
- interiors/16x16/: Interiors_16x16.png (256x17024 = 16x1064 tiles), Room_Builder_16x16.png (1216x1808 = 76x113 tiles).
- NO animation/furniture guide shipped. RPGMAKERMV folder empty. No tilemaps. overview.png = showcase only.
- Known-good Room_Builder coords (validated in old scripts/build_office_bg.py):
  FLOOR_CELL=(col12,row11) clean grey floor; RUG_CELL=(col12,row9) teal rug.

## Environment gotchas (important)
- Image preview is reliable ONLY for small (<=~1500px) PIL-generated PNGs read SOLO (one Read,
  no other tool calls in the message). Large Playwright screenshots fail to render — downscale
  with PIL to <=1400px then Read solo.
- Bash: a denied command in a parallel batch cancels the WHOLE batch. Keep permission-risky bash
  calls separate. dev server already runs on :3000 (next refuses a 2nd instance in same dir).
- Verify rendering programmatically via Playwright browser_evaluate (DOM text + canvas getImageData
  non-blank + camera-pan pixel-diff) when screenshots won't render.

## Current code state
- Branch feat/office-live, working tree clean (committed). OfficeView.tsx = 819-line big-world version:
  resizeTo:window, loads /office-bg.png, 3x3 rooms (WORLD 1920x1280), player=Amelia, WASD+camera,
  NpcCtl (council-gather + phone), sidebar lead list, help overlay, coords HUD.
- Down-direction bug: dir mapping `vy>0 ? 0` assumes run block 0 = "down". Verify block order via
  a solo high-zoom montage of Adam run blocks 0-3 first frames. If block0 != front-facing, remap.

## RESOLVED findings (this session)
- **Direction order is `0=DOWN, 1=UP, 2=LEFT, 3=RIGHT`** for BOTH idle/idle_anim AND run sheets.
  Verified numerically (head-skin per frame: Amelia idle f0..3=[6,0,5,3], run b0..3=[6,0,5,3] —
  index0 highest=face=down, index1=0=back=up) and visually (/tmp/amelia_dir.png).
  => The CURRENT committed mapping `vy>0?0 : vy<0?1 ; vx<0?2:vx>0?3` is CORRECT. Down already faces
  front. The user's "down looks wrong" was an EARLIER build. Re-confirm live, then leave as-is.
- **Furniture extraction pipeline WORKS** (solves the no-guide blocker): auto-segment
  Interiors_16x16.png by 8-connected non-empty tiles → furniture bounding boxes → paginated labeled
  contact sheets `/tmp/cat{N}.png` (each cell = thumbnail + "#id col,row WxH"). Pick furniture by
  reading coords off the contact sheet. Re-generate with the script in this session's history.
  Use these (col,row,w,h) rects to build web/app/office/furniture.ts.

## Plan (next session)
1. tiles.ts: floor/wall/door/window/rug from Room_Builder (validated) + furniture atlas from Interiors
   (extract ~10 pieces via solo high-zoom crops: desk, office chair, monitor, plant x2, sofa, coffee
   table, bookshelf, whiteboard, server rack, kitchen counter, fridge, water cooler).
2. layout.ts: data-driven open-plan floor — pods per dept (sized ~1 screen), council/lounge/kitchen/
   phone room, doors, furniture instances w/ collision boxes. Default = "atelierHQ"; allow multiple.
3. Rewrite OfficeView: render shell+furniture from layout; collision = walls+furniture footprints;
   camera zoom ~1 pod; FIX direction order; place all 36 agents from /api/roles into pods; dynamic
   activation (active depts lively, idle dimmed).
4. Dogfood: confirm SSE wiring; run `atelier start` once on a real product task; verify office reacts.
