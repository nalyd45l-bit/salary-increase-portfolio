#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Original uploads are retained. Only the three web derivatives are replaced.
ffmpeg -y -v error \
  -i assets/media/source-fn.mp4 -i assets/media/source-terminal.mp4 \
  -filter_complex '[1:v]scale=1280:720,setsar=1,split[a][b];[a]trim=start=0.75,setpts=PTS-STARTPTS,fps=24,settb=AVTB[terminal];[b]trim=end=0.75,setpts=PTS-STARTPTS,fps=24,settb=AVTB[head];[0:v]scale=1280:720,setsar=1,setpts=PTS-STARTPTS,fps=24,settb=AVTB[fn];[terminal][fn]xfade=transition=fade:duration=0.75:offset=13.416667[joined];[joined][head]xfade=transition=fade:duration=0.75:offset=22.666667,format=yuv420p[v]' \
  -map '[v]' -an -c:v libx264 -preset medium -crf 25 -movflags +faststart assets/media/hero-loop.mp4
ffmpeg -y -v error -i assets/media/hero-loop.mp4 -vf scale=854:480 \
  -an -c:v libx264 -preset medium -crf 26 -movflags +faststart assets/media/hero-mobile.mp4
ffmpeg -y -v error -i assets/media/hero-loop.mp4 -frames:v 1 -quality 85 assets/media/hero-poster.webp
