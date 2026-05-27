# Rule: Web stack baseline

The `web/` directory is locked to:

- **React 19**
- **Next.js 16** (App Router, server components by default)
- **PixiJS v8** for the office view
- **Zustand** for client state
- **Server-Sent Events** for live event streaming
- **Tailwind v4** for styling
- **Modern Interiors (LimeZu, free version)** tilemap and characters under `assets/modern-interiors/`

Do not downgrade these majors. Do not introduce a parallel UI framework
(Remix, SvelteKit, Vite-only). Do not add Redux or Recoil.
