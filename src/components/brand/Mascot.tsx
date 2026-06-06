/**
 * Vantage mark — a precise, monochrome aperture glyph: a hex lens housing, six
 * iris blades swept around a focal point. It rhymes with the blueprint figures
 * (the FIG_003 iris, the FIG_001 convergence reticle) rather than a literal
 * camera, so it reads as a technical instrument, not a toy. Pure currentColor
 * strokes → it inverts cleanly between dark and light.
 *
 * Kept under the name `Mascot` so every call site (logo, empty states, loaders)
 * picks up the new mark with no other changes. `still` freezes the idle spin.
 */
import { useEffect, useState } from "react";

interface MascotProps {
  size?: number;
  /** freeze the slow idle rotation (e.g. inside the logo lockup) */
  still?: boolean;
  className?: string;
  title?: string;
}

const VB = 32;
const C = VB / 2;
const R_HEX = 13; // lens-housing hexagon circumradius
const R_OUT = 11; // blade outer radius
const R_IN = 4.6; // blade inner radius (aperture opening)
const SWEEP = 34; // degrees each blade is swept (the iris "twist")

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) =>
  `${(C + r * Math.cos(rad(deg))).toFixed(2)} ${(C + r * Math.sin(rad(deg))).toFixed(2)}`;

// hex housing vertices (pointy-top)
const HEX = Array.from({ length: 6 }, (_, i) => pt(R_HEX, -90 + i * 60)).join(" L ");
// six iris blades: outer point swept inward to a focal hexagon
const BLADES = Array.from({ length: 6 }, (_, i) => {
  const a = -90 + i * 60;
  return `M ${pt(R_OUT, a)} L ${pt(R_IN, a + SWEEP)}`;
}).join(" ");

export function Mascot({ size = 64, still = false, className, title }: MascotProps) {
  const [spin, setSpin] = useState(false);

  useEffect(() => {
    if (still) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) setSpin(true);
  }, [still]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VB} ${VB}`}
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* lens housing */}
      <path d={`M ${HEX} Z`} strokeWidth={1.6} />
      {/* iris blades (the only part that spins) */}
      <g
        style={
          spin
            ? { animation: "vantage-spin 14s linear infinite", transformOrigin: "center" }
            : undefined
        }
      >
        <path d={BLADES} strokeWidth={1.5} />
      </g>
      {/* focal point — the single instant */}
      <circle cx={C} cy={C} r={1.5} fill="currentColor" stroke="none" />
    </svg>
  );
}
