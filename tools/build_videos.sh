#!/bin/zsh
# Encode the volleyball highlight reels for the web.
#
#   ./tools/build_videos.sh
#
# Sources: assets-src/videos/highlight*.mov — the original iPhone screen recordings
# (HEVC, 2622×1206 landscape, 60 fps). Output: public/videos/highlight*.mp4 — H.264 at
# 1920 px wide, 60 fps, CRF 19 (visually lossless), AAC audio, faststart so playback
# begins before the whole file downloads. The TV in the Turners gym plays these.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/videos
for src in assets-src/videos/highlight*.mov; do
  out="public/videos/$(basename "${src%.mov}").mp4"
  ffmpeg -v error -y -i "$src" \
    -vf "scale=1920:-2:flags=lanczos" -r 60 \
    -c:v libx264 -preset slow -crf 19 -profile:v high -pix_fmt yuv420p \
    -c:a aac -b:a 160k -movflags +faststart "$out"
  echo "wrote $out"
done
