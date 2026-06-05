/**
 * Pixel confetti burst — tiny motion.div squares (image-rendering: pixelated)
 * that fire outward once. Used on Moment completion. Self-unmounts after the
 * burst by reporting completion, but is cheap to keep mounted briefly.
 */
import { useMemo } from "react";
import { motion } from "motion/react";
import { rng, hashSeed } from "@/lib/pixel";

interface PixelConfettiProps {
  /** number of squares */
  count?: number;
  /** seed for deterministic-but-varied bursts */
  seed?: string;
  className?: string;
}

const COLORS = [
  "var(--primary)",
  "var(--accent)",
  "var(--moment)",
  "var(--live)",
  "var(--foreground)",
];

export function PixelConfetti({
  count = 48,
  seed = "moment",
  className,
}: PixelConfettiProps) {
  const pieces = useMemo(() => {
    const next = rng(hashSeed(seed));
    return Array.from({ length: count }).map((_, i) => {
      const angle = next() * Math.PI * 2;
      const dist = 80 + next() * 220;
      return {
        id: i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 60, // bias upward
        size: 5 + Math.floor(next() * 7),
        rot: (next() - 0.5) * 540,
        color: COLORS[Math.floor(next() * COLORS.length)],
        delay: next() * 0.08,
        duration: 0.7 + next() * 0.6,
      };
    });
  }, [count, seed]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 grid place-items-center overflow-hidden ${className ?? ""}`}
      aria-hidden="true"
    >
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="pixelated absolute"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            x: p.dx,
            y: [p.dy, p.dy + 140],
            opacity: [1, 1, 0],
            rotate: p.rot,
            scale: [1, 1, 0.6],
          }}
          transition={{
            duration: p.duration,
            ease: "easeOut",
            delay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
