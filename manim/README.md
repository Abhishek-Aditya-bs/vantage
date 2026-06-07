# Vantage — the marketing film (Manim)

A hand-authored [Manim](https://github.com/ManimCommunity/manim) animation for the
landing page, drawn in the same strict-monochrome **"technical reference manual"**
language as the site's static blueprint figures (`src/components/landing/figures/*`):
1px ink hairlines, Geist Mono labels, leader lines, dashed registration guides,
45° cross-hatch, the dot-grid plate, and the aperture mark.

It narrates the product in six plates — **intro → join → live wall → the Moment →
recap reel → CTA** — and ships as two cuts: a dark plate and its white-paper
inverse, served per active theme by `src/components/landing/FilmPlate.tsx`.

The rendered MP4s + posters live in `public/` (`vantage-film*.mp4`,
`vantage-film-poster*.jpg`) and are the shipping artifact. This directory is the
*source*; `fonts/`, `media/`, and the venv are gitignored.

## Files
- `vantage_theme.py` — the blueprint drawing kit (palette, type, primitives, the
  aperture mark, phone, iris, tile, QR). `VANTAGE_LIGHT=1` swaps to the inverse palette.
- `vantage_film.py` — the `VantageFilm` scene (the six plates).
- `smoke_test.py`, `dev_recap.py` — fast single-frame / single-chapter dev harnesses.
- `fetch_fonts.sh` — re-download the brand TTFs into `fonts/`.

## Setup (macOS)
```bash
brew install cairo pango pkg-config ffmpeg            # native deps
python3 -m venv ../.manim-venv
PKG_CONFIG_PATH="$(brew --prefix)/lib/pkgconfig" ../.manim-venv/bin/pip install manim
./fetch_fonts.sh
```

## Render
```bash
cd manim
# dark cut  → media/videos/vantage_film/1080p30/VantageFilm.mp4
../.manim-venv/bin/manim -qh --fps 30 vantage_film.py VantageFilm
# light cut → VantageFilmLight.mp4
VANTAGE_LIGHT=1 ../.manim-venv/bin/manim -qh --fps 30 -o VantageFilmLight vantage_film.py VantageFilm
```

## Publish (web-encode + posters → public/)
```bash
S=media/videos/vantage_film/1080p30
for cut in "VantageFilm vantage-film" "VantageFilmLight vantage-film-light"; do
  set -- $cut
  ffmpeg -y -i "$S/$1.mp4" -c:v libx264 -profile:v high -pix_fmt yuv420p \
         -crf 23 -preset slow -movflags +faststart -an "../public/$2.mp4"
done
ffmpeg -y -ss 6.9 -i "$S/VantageFilm.mp4"      -frames:v 1 -q:v 3 ../public/vantage-film-poster.jpg
ffmpeg -y -ss 6.9 -i "$S/VantageFilmLight.mp4" -frames:v 1 -q:v 3 ../public/vantage-film-poster-light.jpg
```
Then `npm run deploy` from the repo root.
