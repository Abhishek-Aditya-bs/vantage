/**
 * Pixel-art camera mascot — a boxy one-lens camera drawn as an SVG grid of
 * <rect>s on a 16x16 cell lattice. The lens periodically "blinks" (shutter)
 * unless the user prefers reduced motion. Used in logo, empty states, loaders.
 *
 * Colors are brand tokens, so it tracks light/dark automatically.
 */
import { useEffect, useState } from "react";

interface MascotProps {
  size?: number;
  /** disable the periodic shutter blink (e.g. inside the logo lockup) */
  still?: boolean;
  className?: string;
  title?: string;
}

const CELL = 16; // 16x16 grid
const U = 4; // unit size in viewBox space  -> 64x64 viewBox

/** A small rect helper in grid coordinates. */
function px(x: number, y: number, w: number, h: number, fill: string, key: string) {
  return (
    <rect
      key={key}
      x={x * U}
      y={y * U}
      width={w * U}
      height={h * U}
      fill={fill}
    />
  );
}

export function Mascot({ size = 64, still = false, className, title }: MascotProps) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (still) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;
    let timeout: number;
    const loop = () => {
      // blink the shutter briefly, then wait a randomized beat
      setBlink(true);
      timeout = window.setTimeout(() => {
        setBlink(false);
        timeout = window.setTimeout(loop, 2600 + Math.random() * 2600);
      }, 130);
    };
    timeout = window.setTimeout(loop, 1800);
    return () => window.clearTimeout(timeout);
  }, [still]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${CELL * U} ${CELL * U}`}
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      shapeRendering="crispEdges"
    >
      {/* viewfinder bump on top */}
      {px(9, 1, 3, 1, "var(--foreground)", "bump")}
      {/* camera body */}
      {px(1, 3, 14, 11, "var(--foreground)", "body")}
      {/* inset face plate (card color = the "front panel") */}
      {px(2, 4, 12, 9, "var(--card)", "face")}
      {/* shutter button */}
      {px(3, 2, 2, 1, "var(--moment)", "shutter")}
      {/* lens outer ring (amber) */}
      {px(5, 6, 6, 6, "var(--primary)", "lensring")}
      {/* lens body */}
      {px(6, 7, 4, 4, "var(--foreground)", "lensbody")}
      {/* glass / iris — blinks to a thin slit */}
      {blink
        ? px(7, 8, 2, 1, "var(--accent)", "glass-blink")
        : px(7, 8, 2, 2, "var(--accent)", "glass")}
      {/* catch-light highlight (hidden during blink) */}
      {!blink && px(7, 8, 1, 1, "var(--card)", "catch")}
      {/* flash window (teal) */}
      {px(11, 5, 2, 2, "var(--accent)", "flash")}
    </svg>
  );
}
