#!/usr/bin/env bash
# Render the CLI demo gif.
#
# `atelier start` makes real G1->G5 LLM calls, so the raw recording contains a
# long static stretch while the run is in flight. We record at full fidelity,
# then speed up only that wait window so the published gif stays watchable while
# still showing the real run finishing into typed `atelier result` output.
#
# Requires: vhs, ffmpeg. Run from the repo root with the venv available.
set -euo pipefail

cd "$(dirname "$0")/.."

RAW=/tmp/atelier-cli-raw.gif
OUT=docs/demo.gif

vhs docs/demo.tape

# Detect the live-wait window: low-detail frames between the intro commands and
# the final result output. Empirically the run sits idle ~25s..~99s; speed that
# 25x and keep the intro and result segments at normal speed.
ffmpeg -y -i "$RAW" -filter_complex "\
[0:v]trim=0:25,setpts=PTS-STARTPTS[a];\
[0:v]trim=25:99,setpts=(PTS-STARTPTS)/25[b];\
[0:v]trim=99,setpts=PTS-STARTPTS[c];\
[a][b][c]concat=n=3:v=1[s];\
[s]split[s1][s2];[s1]palettegen=stats_mode=diff[p];[s2][p]paletteuse=dither=bayer[out]" \
  -map "[out]" "$OUT"

echo "wrote $OUT"
