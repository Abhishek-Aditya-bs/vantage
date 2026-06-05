/**
 * Live-wall concept preview — a contact-sheet grid where new "photos" land on
 * the surface one by one (entering from a random edge, settling to rotate:0),
 * exactly like the real wall. Pure colored tiles (no external images).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { rng, hashSeed } from "@/lib/pixel";

const TILE_COLORS = [
  "var(--primary)",
  "var(--accent)",
  "var(--moment)",
  "var(--live)",
  "var(--muted-foreground)",
];

interface Tile {
  id: number;
  color: string;
  edge: number;
  rot: number;
  span: boolean;
}

function makeTile(id: number): Tile {
  const next = rng(hashSeed(`tile-${id}`));
  return {
    id,
    color: TILE_COLORS[Math.floor(next() * TILE_COLORS.length)],
    edge: Math.floor(next() * 4),
    rot: (next() - 0.5) * 10,
    span: next() > 0.78,
  };
}

const EDGE_OFFSET = [
  { x: 0, y: -60 }, // top
  { x: 60, y: 0 }, // right
  { x: 0, y: 60 }, // bottom
  { x: -60, y: 0 }, // left
];

export function LiveWallPreview() {
  const [tiles, setTiles] = useState<Tile[]>(() =>
    Array.from({ length: 6 }, (_, i) => makeTile(i)),
  );

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;
    let n = 6;
    const id = window.setInterval(() => {
      n += 1;
      setTiles((prev) => {
        const next = [...prev, makeTile(n)];
        return next.slice(-12); // keep the wall bounded
      });
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" aria-hidden="true">
      <AnimatePresence mode="popLayout">
        {tiles.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{
              opacity: 0,
              x: EDGE_OFFSET[t.edge].x,
              y: EDGE_OFFSET[t.edge].y,
              rotate: t.rot * 2.5,
              scale: 0.9,
            }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: t.rot, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.36, ease: "easeOut" }}
            className={`aspect-square rounded-sm border border-border ${t.span ? "col-span-2 row-span-2" : ""}`}
            style={{ backgroundColor: t.color, opacity: 0.85 }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
