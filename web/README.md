# Atelier web

Next.js 16 + React 19 + PixiJS v8 dashboard for Atelier.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Routes

- `/` — Landing page
- `/office` — Live PixiJS office view, animated by the SSE event stream
- `/dashboard` — Per-project artifact summaries
- `/api/events` — SSE proxy that tails `../runs/events.jsonl`

## How it connects to the Python side

The web layer reads two artifacts that the Python CLI produces:

1. **`runs/events.jsonl`** — newline-delimited JSON events written by
   `atelier.observability.tracer.trace_event(...)`. The SSE endpoint at
   `/api/events` tails this file and pushes new lines to connected clients.
2. **`artifacts/<project_id>/result.json`** — the final state of each run.
   The dashboard lists every project that has a `result.json`.

Override the directories with `ATELIER_RUNS_DIR` and `ATELIER_ARTIFACTS_DIR`.

## Assets

Sprites are served from `/public/assets/modern-interiors/`. Set this up with:

```bash
mkdir -p public/assets
ln -s ../../assets/modern-interiors public/assets/modern-interiors
```

(Or copy if you prefer no symlinks.)
