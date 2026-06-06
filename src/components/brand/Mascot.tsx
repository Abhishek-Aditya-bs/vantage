/**
 * Pixel camera glyph — a boxy one-lens camera drawn as an SVG grid of <rect>s on
 * a 16×16 lattice. Strictly monochrome (foreground ink on the page background),
 * so it reads as a refined technical mark, not a toy. The iris periodically
 * blinks (a shutter) unless the user prefers reduced motion.
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

function px(x: number, y: number, w: number, h: number, fill: string, key: string) {
  return <rect key={key} x={x * U} y={y * U} width={w * U} height={h * U} fill={fill} />;
}

export function Mascot({ size = 64, still = false, className, title }: MascotProps) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (still) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let timeout: number;
    const loop = () => {
      setBlink(true);
      timeout = window.setTimeout(() => {
        setBlink(false);
        timeout = window.setTimeout(loop, 2600 + Math.random() * 2600);
      }, 130);
    };
    timeout = window.setTimeout(loop, 1800);
    return () => window.clearTimeout(timeout);
  }, [still]);

  const ink = "var(--foreground)";
  const paper = "var(--background)";
  const dim = "var(--muted-foreground)";

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
      {px(9, 1, 3, 1, ink, "bump")}
      {/* shutter button */}
      {px(3, 2, 2, 1, dim, "shutter")}
      {/* camera body (solid ink block) */}
      {px(1, 3, 14, 11, ink, "body")}
      {/* inset face plate (paper) */}
      {px(2, 4, 12, 9, paper, "face")}
      {/* lens outer ring (ink) */}
      {px(5, 6, 6, 6, ink, "lensring")}
      {/* lens cavity (paper) */}
      {px(6, 7, 4, 4, paper, "lenscavity")}
      {/* iris — blinks from a square to a thin slit */}
      {blink ? px(7, 8, 2, 1, ink, "iris-blink") : px(7, 8, 2, 2, ink, "iris")}
      {/* flash window */}
      {px(11, 5, 2, 2, ink, "flash")}
      {px(12, 5, 1, 1, paper, "flash-glint")}
    </svg>
  );
}
