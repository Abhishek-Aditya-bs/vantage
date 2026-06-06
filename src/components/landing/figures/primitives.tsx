/**
 * Shared SVG primitives for the blueprint diagrams. Everything draws in
 * `currentColor` (1px hairlines), so a figure inverts cleanly between dark and
 * light. No color, ever — this is engineering-drawing ink.
 */
import type { ReactNode } from "react";

export const INK = "currentColor";

/** A monospace technical label. */
export function Label({
  x,
  y,
  children,
  anchor = "start",
  size = 11,
  dim = false,
  baseline = "middle",
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  size?: number;
  dim?: boolean;
  baseline?: "middle" | "auto" | "hanging";
}) {
  return (
    <text
      x={x}
      y={y}
      fill={INK}
      fontFamily="var(--font-mono)"
      fontSize={size}
      letterSpacing={size * 0.06}
      textAnchor={anchor}
      dominantBaseline={baseline}
      opacity={dim ? 0.55 : 0.9}
      style={{ textTransform: "uppercase" }}
    >
      {children}
    </text>
  );
}

/** A leader line from (x1,y1) to a part at (x2,y2), tipped with an arrowhead. */
export function Leader({
  x1,
  y1,
  x2,
  y2,
  head = 6,
  dashed = false,
  opacity = 0.65,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  head?: number;
  dashed?: boolean;
  opacity?: number;
}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const w = head * 0.62;
  const bx = x2 - head * Math.cos(a);
  const by = y2 - head * Math.sin(a);
  const p1 = `${(bx - w * Math.sin(a)).toFixed(2)},${(by + w * Math.cos(a)).toFixed(2)}`;
  const p2 = `${(bx + w * Math.sin(a)).toFixed(2)},${(by - w * Math.cos(a)).toFixed(2)}`;
  return (
    <g stroke={INK} opacity={opacity}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeWidth={1}
        strokeDasharray={dashed ? "3 3" : undefined}
      />
      <polygon points={`${x2},${y2} ${p1} ${p2}`} fill={INK} stroke="none" />
    </g>
  );
}

/** Dashed registration / construction line (the exploded-view alignment guide). */
export function Reg({
  x1,
  y1,
  x2,
  y2,
  opacity = 0.4,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity?: number;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={INK}
      strokeWidth={1}
      strokeDasharray="2 5"
      opacity={opacity}
    />
  );
}

/** Diagonal cross-hatch fill pattern. Drop into <defs>; reference by id. */
export function Hatch({ id, gap = 5, opacity = 0.5 }: { id: string; gap?: number; opacity?: number }) {
  return (
    <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1={0} y1={0} x2={0} y2={gap} stroke={INK} strokeWidth={0.7} opacity={opacity} />
    </pattern>
  );
}

/** Small tick mark on an axis. */
export function Tick({ x, y, len = 5, opacity = 0.6 }: { x: number; y: number; len?: number; opacity?: number }) {
  return <line x1={x} y1={y - len} x2={x} y2={y + len} stroke={INK} strokeWidth={1} opacity={opacity} />;
}
