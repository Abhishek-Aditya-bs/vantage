/**
 * Shared recap timeline — the single source of truth for how a space's media
 * becomes a story. BOTH the on-screen reel preview and the exported video build
 * their frames from `buildSegments`, so "what you preview is what you save".
 *
 *   title card  →  chronological [ Moments (multi-angle) + photos ]  →  outro
 */
import type { MediaMeta } from "@shared/protocol";

export type Segment =
  | { kind: "title"; id: string; t: number }
  | { kind: "moment"; id: string; frames: MediaMeta[]; t: number }
  | { kind: "slide"; id: string; frame: MediaMeta; t: number };

/** Per-segment hold times (ms) — used by the preview timer and the exporter. */
export const TIMING = {
  title: 3000,
  moment: 3800,
  slide: 2600,
  outro: 2400,
} as const;

/** Columns for a moment's multi-angle collage, by frame count. */
export const momentCols = (n: number): number => (n <= 4 ? 2 : n <= 9 ? 3 : 4);

/**
 * Build the ordered timeline from a space's media.
 * Moments with ≥2 angles become a single multi-angle "moment" segment; lone
 * frames (incl. single-angle moments) become "slide" segments. Everything is
 * sorted chronologically, with a title card prepended when non-empty.
 */
export function buildSegments(media: MediaMeta[]): Segment[] {
  const byMoment = new Map<string, MediaMeta[]>();
  const loose: MediaMeta[] = [];
  for (const m of media) {
    if (m.kind === "moment" && m.momentId) {
      const arr = byMoment.get(m.momentId) ?? [];
      arr.push(m);
      byMoment.set(m.momentId, arr);
    } else {
      loose.push(m);
    }
  }
  const segs: Segment[] = [];
  for (const [id, frames] of byMoment) {
    const sorted = [...frames].sort((a, b) => a.createdAt - b.createdAt);
    if (sorted.length >= 2)
      segs.push({ kind: "moment", id, frames: sorted, t: sorted[0].createdAt });
    else loose.push(...sorted);
  }
  for (const f of loose)
    segs.push({ kind: "slide", id: f.id, frame: f, t: f.createdAt });
  segs.sort((a, b) => a.t - b.t);
  if (segs.length > 0)
    segs.unshift({ kind: "title", id: "__title__", t: -Infinity });
  return segs;
}

/* ----------------------------------------------- slide transition variety --- */

/**
 * A calm Ken-Burns variant, chosen deterministically per slide so the reel
 * doesn't repeat the same move. Values are fractions of the frame: `scale`
 * multiplies the contained image; `x`/`y` pan as a fraction of width/height.
 */
export interface KenBurns {
  from: { scale: number; x: number; y: number };
  to: { scale: number; x: number; y: number };
}

const KENBURNS: KenBurns[] = [
  { from: { scale: 1.0, x: 0, y: 0 }, to: { scale: 1.14, x: 0, y: 0 } }, // push in
  { from: { scale: 1.14, x: 0, y: 0 }, to: { scale: 1.0, x: 0, y: 0 } }, // pull out
  { from: { scale: 1.12, x: -0.04, y: 0 }, to: { scale: 1.12, x: 0.04, y: 0 } }, // pan →
  { from: { scale: 1.12, x: 0.04, y: 0 }, to: { scale: 1.12, x: -0.04, y: 0 } }, // pan ←
  { from: { scale: 1.12, x: 0, y: 0.04 }, to: { scale: 1.16, x: 0, y: -0.04 } }, // rise
  { from: { scale: 1.16, x: 0.03, y: -0.03 }, to: { scale: 1.06, x: -0.03, y: 0.03 } }, // drift
];

export function kenBurns(index: number): KenBurns {
  return KENBURNS[index % KENBURNS.length];
}

/** Entrance transition between slides, varied per index (for the live preview). */
export type EnterStyle = "fade" | "slide-left" | "slide-right" | "slide-up" | "zoom";

const ENTERS: EnterStyle[] = [
  "fade",
  "slide-left",
  "zoom",
  "slide-up",
  "slide-right",
  "fade",
];

export function enterStyle(index: number): EnterStyle {
  return ENTERS[index % ENTERS.length];
}
