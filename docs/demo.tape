# Atelier CLI demo
# Render: vhs docs/demo.tape

Output docs/demo.gif

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

Type `atelier start "weekly retrospective CLI for solo developers" --project-id weekly-retro` Sleep 400ms Enter
Sleep 3s

Type "atelier result --project-id weekly-retro | head -30" Sleep 400ms Enter
Sleep 4s
