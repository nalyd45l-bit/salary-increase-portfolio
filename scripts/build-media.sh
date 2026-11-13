#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Keep both original uploads unchanged. Hero: terminal only. FN: scroll sequence below.
ffmpeg -y -v error -i assets/media/source-terminal.mp4 \
  -filter_complex '[0:v]scale=1280:720,setsar=1,split[a][b];[a]trim=start=0.75,setpts=PTS-STARTPTS,fps=24,settb=AVTB[main];[b]trim=end=0.75,setpts=PTS-STARTPTS,fps=24,settb=AVTB[head];[main][head]xfade=transition=fade:duration=0.75:offset=13.416667,format=yuv420p[v]' \
  -map '[v]' -an -c:v libx264 -preset medium -crf 25 -movflags +faststart assets/media/hero-loop.mp4
ffmpeg -y -v error -i assets/media/hero-loop.mp4 -vf scale=854:480 -an -c:v libx264 -preset medium -crf 26 -movflags +faststart assets/media/hero-mobile.mp4
ffmpeg -y -v error -i assets/media/hero-loop.mp4 -frames:v 1 -quality 85 assets/media/hero-poster.webp
mkdir -p assets/media/fn36-frames
ffmpeg -y -v error -i assets/media/source-fn.mp4 -t 4 -vf 'fps=16,scale=960:540' -c:v libwebp -f image2 -start_number 0 -quality 80 assets/media/fn36-frames/frame-%03d.webp
ffmpeg -y -v error -i assets/media/source-fn.mp4 -frames:v 1 -vf scale=960:540 -quality 85 assets/media/fn36-poster.webp
