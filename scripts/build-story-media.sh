#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# New user-supplied illustrations. Source uploads remain byte-identical.
make_loop() {
  local scene_name="$1"
  local fade_offset="$2"
  local output_name="$scene_name"
  if [ "$scene_name" = fn ]; then output_name=fn36; fi
  ffmpeg -y -v error -i "assets/media/source-${scene_name}.mp4" \
    -filter_complex "[0:v]scale=1280:720,setsar=1,split[a][b];[a]trim=start=0.75,setpts=PTS-STARTPTS,fps=24,settb=AVTB[main];[b]trim=end=0.75,setpts=PTS-STARTPTS,fps=24,settb=AVTB[head];[main][head]xfade=transition=fade:duration=0.75:offset=${fade_offset},format=yuv420p[v]" \
    -map '[v]' -an -c:v libx264 -preset medium -crf 25 -movflags +faststart "assets/media/${output_name}-loop.mp4"
  ffmpeg -y -v error -i "assets/media/${output_name}-loop.mp4" -vf scale=854:480 -an -c:v libx264 -preset medium -crf 26 -movflags +faststart "assets/media/${output_name}-mobile.mp4"
  ffmpeg -y -v error -i "assets/media/${output_name}-loop.mp4" -frames:v 1 -quality 85 "assets/media/${output_name}-poster.webp"
}
make_loop fn 8.5
make_loop account 8.5
make_loop payment 13.416667
