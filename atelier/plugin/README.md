# Atelier — Claude Code plugin

This directory exposes Atelier as a Claude Code plugin. Drop it into your
`.claude/plugins/atelier` path, then:

- `/atelier-start <request>` — runs the full G1–G5 graph
- `/atelier-approve <path>` — approves a gate card
- `/atelier-status` — reports provider readiness and quota cap

The slash commands live under `../../.claude/commands/`. The plugin manifest is
`plugin.json` in this directory.
