# Atelier CLI demo
# Render: scripts/record_cli.sh  (runs vhs on this tape, then trims the live LLM wait)
# Raw output goes to /tmp/atelier-cli-raw.gif; the script post-processes it to docs/demo.gif.

Output /tmp/atelier-cli-raw.gif

Set FontSize 14
Set Width 1100
Set Height 620
Set Theme "Dracula"
Set Shell "zsh"
Set TypingSpeed 30ms

Hide
Type "source .venv/bin/activate && rm -rf /tmp/atelier-demo && mkdir /tmp/atelier-demo && cd /tmp/atelier-demo && clear" Enter
Sleep 500ms
Show

Type "atelier version" Sleep 400ms Enter
Sleep 1.5s

Type "atelier auth status" Sleep 400ms Enter
Sleep 2s

Type "atelier mcp list --department Engineering" Sleep 400ms Enter
Sleep 2.5s

# Live run: G1->G5 with real LLM calls. Wait for completion instead of a fixed sleep
# so the final `atelier result` always renders against a freshly written result.json.
Type `atelier start "weekly retrospective CLI for solo developers" --project-id weekly-retro` Sleep 400ms Enter
Wait+Screen@180s /done gate=/

Type "atelier result --project-id weekly-retro | head -30" Sleep 400ms Enter
Sleep 5s
