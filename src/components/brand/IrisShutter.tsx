/**
 * Animated SVG iris/aperture — six blades that rotate and close/open.
 *
 * Two modes:
 *  - SPINNER (default): blades idle-rotate continuously as a loading indicator.
 *  - PROGRESS (pass `progress` 0..1): the aperture closes as progress → 1, so it
 *    reads as a Moment countdown filling up. At progress 1 it is fully shut.
 *
 * `active` can be used to give it the moment-red treatment during a capture.
 * Built from pure SVG so it is CSP-safe and theme-aware.
 */
import { useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface IrisShutterProps {
  size?: number;
  /** 0 = fully open, 1 = fully closed. Omit for continuous spinner mode. */
  progress?: number;
  /** moment-red accent treatment (during capture) */
  active?: boolean;
  className?: string;
  /** optional big centered label (e.g. the countdown digit) */
  label?: string;
  ariaLabel?: string;
}

const BLADES = 6;
const VB = 100; // viewBox
const C = VB / 2;

/**
 * Build a single aperture-blade path. Each blade is a triangle-ish wedge from
 * the rim toward the center; `close` (0..1) slides its inner tip toward the
 * middle so the hexagonal opening shrinks.
 */
function bladePath(open: number): string {
  // outer radius fixed; inner aperture radius shrinks as we close
  const rOuter = 52;
  const rInner = 8 + open * 34; // open=1 -> wide hole, open=0 -> tiny hole
  const half = Math.PI / BLADES; // half blade angular width
  // each blade spans an arc; tip points inward, base sits on the rim
  const a0 = -half;
  const a1 = half;
  const p = (r: number, a: number) =>
    `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
  // blade quad: two rim points + one inner point, slightly offset for the swirl
  const innerA = a0 + half * 0.5;
  return `M ${p(rOuter, a0)} L ${p(rOuter, a1)} L ${p(rInner, innerA)} Z`;
}

export function IrisShutter({
  size = 120,
  progress,
  active = false,
  className,
  label,
  ariaLabel,
}: IrisShutterProps) {
  const isProgress = typeof progress === "number";
  const open = isProgress ? 1 - Math.min(1, Math.max(0, progress)) : 1;
  const path = useMemo(() => bladePath(open), [open]);

  const bladeColor = active ? "var(--moment)" : "var(--primary)";

  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel ?? (isProgress ? "Capture countdown" : "Loading")}
    >
      <motion.svg
        width={size}
        height={size}
        viewBox={`0 0 ${VB} ${VB}`}
        // spinner mode: continuous rotation; progress mode: gentle hold
        animate={isProgress ? { rotate: (1 - open) * 30 } : { rotate: 360 }}
        transition={
          isProgress
            ? { duration: 0.4, ease: "easeOut" }
            : { duration: 2.4, ease: "linear", repeat: Infinity }
        }
        style={{ transformOrigin: "50% 50%" }}
      >
        {/* rim */}
        <circle
          cx={C}
          cy={C}
          r={48}
          fill="none"
          stroke="var(--border)"
          strokeWidth={2}
        />
        {/* blades */}
        <g>
          {Array.from({ length: BLADES }).map((_, i) => (
            <motion.path
              key={i}
              d={path}
              fill={bladeColor}
              fillOpacity={0.85 - (i % 2) * 0.18}
              transform={`rotate(${(360 / BLADES) * i} ${C} ${C})`}
              initial={false}
              animate={{ d: path }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            />
          ))}
        </g>
        {/* center aperture hole */}
        <circle cx={C} cy={C} r={Math.max(2, open * 9)} fill="var(--card)" />
      </motion.svg>
      {label !== undefined && (
        <span className="pointer-events-none absolute font-display text-3xl font-bold tabular-nums text-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
