/**
 * FilmPlate — the embedded marketing film, framed as a blueprint plate.
 *
 * The film is a hand-authored Manim animation (manim/vantage_film.py) rendered
 * in the same strict-monochrome "technical reference manual" language as the
 * static figures. Two cuts ship: a dark plate and its white-paper inverse; we
 * serve the one that matches the active theme, exactly like every other figure.
 *
 * A silent, looping ambient trailer — so it autoplays muted, and honours
 * prefers-reduced-motion by holding on the poster until the viewer taps play.
 */
import { useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Aperture, Play } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

export function FilmPlate() {
  const { theme } = useTheme();
  const reduce = useReducedMotion();
  const dark = theme === "dark";

  const src = dark ? "/vantage-film.mp4" : "/vantage-film-light.mp4";
  const poster = dark ? "/vantage-film-poster.jpg" : "/vantage-film-poster-light.jpg";

  const videoRef = useRef<HTMLVideoElement>(null);
  // When motion is reduced we hold on the poster behind a play affordance.
  const [held, setHeld] = useState<boolean>(() => Boolean(reduce));

  const play = () => {
    setHeld(false);
    // next paint: the element now allows playback
    requestAnimationFrame(() => void videoRef.current?.play().catch(() => undefined));
  };

  return (
    <figure className="relative overflow-hidden border border-border bg-card/30">
      {/* top console rail — mirrors the FIG rails on the static plates */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.68rem]">
          <span className="text-foreground">FIG_000</span>
          <span className="hidden h-3 w-px bg-border sm:inline-block" />
          <span className="inline-flex items-center gap-1.5">
            <Aperture className="size-3" /> The Film
          </span>
        </div>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.68rem]">
          00:54 · loop · muted
        </span>
      </div>

      {/* the film */}
      <div className="relative aspect-video w-full bg-background">
        <video
          key={src}
          ref={videoRef}
          className="h-full w-full object-cover"
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          autoPlay={!reduce}
          controls={!!reduce && !held}
          preload="metadata"
          aria-label="Vantage product film — a room of phones joins a space by QR, photos stream onto a live wall, every phone fires one synchronized Moment, then it plays back as a vertical recap reel."
        />

        {held && (
          <button
            type="button"
            onClick={play}
            className="group absolute inset-0 grid place-items-center bg-background/40 backdrop-blur-[1px] transition-colors hover:bg-background/25"
            aria-label="Play the Vantage film"
          >
            <span className="inline-flex items-center gap-2.5 border border-border bg-background/80 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-foreground transition-transform group-hover:scale-[1.03]">
              <Play className="size-4" /> Play the film
            </span>
          </button>
        )}
      </div>

      {/* caption rail */}
      <figcaption className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 sm:px-4">
        <span className="truncate font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground sm:text-[0.64rem]">
          Join → live wall → the Moment → recap reel
        </span>
        <span className="shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground/70 sm:text-[0.64rem]">
          (c) 2026
        </span>
      </figcaption>
    </figure>
  );
}
