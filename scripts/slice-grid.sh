#!/bin/bash
# Cuts a Gemini turntable grid into one JPEG per frame (macOS `sips`, no installs).
# Usage: scripts/slice-grid.sh <grid.png> <body-type> [cols=6] [rows=4]
# Writes assets/images/360/<body-type>/00.jpg ... in reading order (left to right, top to bottom).
set -euo pipefail
src="$1"; type="$2"; cols="${3:-6}"; rows="${4:-4}"
w=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')
h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/{print $2}')
cw=$((w / cols)); ch=$((h / rows))
out="assets/images/360/$type"; mkdir -p "$out"
echo "grid ${w}x${h} -> ${cols}x${rows} cells of ${cw}x${ch}"
i=0
for ((r = 0; r < rows; r++)); do
  for ((c = 0; c < cols; c++)); do
    n=$(printf "%02d" $i)
    oy=$((r * ch)); ox=$((c * cw))
    # sips ignores an offset of exactly 0,0 and crops the centre instead, so the first cell starts 1px in
    if [ "$oy" -eq 0 ] && [ "$ox" -eq 0 ]; then ox=1; fi
    sips -c "$ch" "$cw" --cropOffset "$oy" "$ox" -s format jpeg -s formatOptions 88 "$src" --out "$out/$n.jpg" >/dev/null
    i=$((i + 1))
  done
done
echo "wrote $i frames to $out"
