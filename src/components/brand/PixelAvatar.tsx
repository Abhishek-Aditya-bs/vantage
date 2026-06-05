/**
 * Deterministic pixel-art avatar from `avatarSeed` — a vertically-symmetric
 * 5x5 grid of <rect>s in a brand-token color. Optionally shows a teal
 * "presence pulse" ring when the member is currently connected.
 */
import { useMemo } from "react";
import { motion } from "motion/react";
import { avatarColor, avatarGrid } from "@/lib/pixel";
import { cn } from "@/lib/utils";

interface PixelAvatarProps {
  seed: string;
  size?: number;
  /** show the teal CSS presence pulse ring */
  active?: boolean;
  title?: string;
  className?: string;
}

const GRID = 5;

export function PixelAvatar({
  seed,
  size = 36,
  active = false,
  title,
  className,
}: PixelAvatarProps) {
  const grid = useMemo(() => avatarGrid(seed), [seed]);
  const color = useMemo(() => avatarColor(seed), [seed]);
  const cell = 100 / GRID;

  return (
    <span
      className={cn("relative inline-grid place-items-center rounded-sm", className)}
      style={{ width: size, height: size }}
      title={title}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="rounded-sm"
        shapeRendering="crispEdges"
        role={title ? "img" : "presentation"}
        aria-label={title}
        aria-hidden={title ? undefined : true}
      >
        <rect width={100} height={100} fill="var(--secondary)" />
        {grid.map((row, y) =>
          row.map((on, x) =>
            on ? (
              <rect
                key={`${x}-${y}`}
                x={x * cell}
                y={y * cell}
                width={cell}
                height={cell}
                fill={color}
              />
            ) : null,
          ),
        )}
      </svg>
      {/* teal presence pulse ring — motion handles reduced-motion globally */}
      {active && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-2px] rounded-[5px] ring-1 ring-accent"
          />
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-2px] rounded-[5px] ring-1 ring-accent"
            animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.35, 1] }}
            transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
          />
        </>
      )}
    </span>
  );
}
