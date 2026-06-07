#!/usr/bin/env bash
# Fetch the self-hosted brand fonts as TTF for Manim/Pango.
# (manim/fonts/ is gitignored; the rendered MP4s in public/ are the artifact.)
# Geist / Geist Mono: OFL, Vercel.  EB Garamond: OFL, Google Fonts.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fonts && cd fonts

base_geist="https://github.com/vercel/geist-font/raw/main/packages/next/dist/fonts"
for w in Regular Medium SemiBold Bold; do
  curl -fsSL -o "Geist-$w.ttf"     "$base_geist/geist-sans/Geist-$w.ttf"
done
for w in Regular Medium; do
  curl -fsSL -o "GeistMono-$w.ttf" "$base_geist/geist-mono/GeistMono-$w.ttf"
done

eg="https://github.com/google/fonts/raw/main/ofl/ebgaramond"
curl -fsSL -o "EBGaramond-Regular.ttf" "$eg/EBGaramond%5Bwght%5D.ttf"
curl -fsSL -o "EBGaramond-Italic.ttf"  "$eg/EBGaramond-Italic%5Bwght%5D.ttf"

echo "Fonts ready:"; ls -1
