/**
 * Moment viewer — the multi-angle artifact, shown CALMLY (no strobing):
 *   • Single view: one angle at a time with a smooth crossfade; step with the
 *     arrows, a swipe, or the thumbnails.
 *   • Grid view: every angle of the one instant at once — a contact sheet of the
 *     moment.
 * Nothing auto-advances, so it never flashes. Fires PixelConfetti once on open.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight, X, LayoutGrid, Maximize2 } from "lucide-react";
import type { MediaMeta } from "@shared/protocol";
import { api } from "@/lib/api";
import { PixelConfetti } from "@/components/brand/PixelConfetti";
import { Mascot } from "@/components/brand/Mascot";

interface MomentViewerProps {
  code: string;
  momentId: string;
  media: MediaMeta[];
  onClose: () => void;
}

export function MomentViewer({ code, momentId, media, onClose }: MomentViewerProps) {
  const [index, setIndex] = useState(0);
  const [grid, setGrid] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const count = media.length;
  const multi = count > 1;

  const go = useCallback(
    (dir: number) => {
      if (count === 0) return;
      setIndex((i) => (i + dir + count) % count);
    },
    [count],
  );

  // confetti is one-shot
  useEffect(() => {
    const id = window.setTimeout(() => setShowConfetti(false), 1600);
    return () => window.clearTimeout(id);
  }, []);

  // keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key.toLowerCase() === "g" && multi) setGrid((g) => !g);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose, multi]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) go(1);
    else if (info.offset.x > 60) go(-1);
  };

  const cols = useMemo(() => (count <= 4 ? 2 : count <= 9 ? 3 : 4), [count]);
  const current = media[index];

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col bg-background/97"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      role="dialog"
      aria-modal="true"
      aria-label="Moment — multi-angle view"
    >
      {showConfetti && <PixelConfetti seed={momentId} />}

      {/* header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-moment">
            ● the moment
          </p>
          <p className="mt-0.5 font-display text-lg font-bold">
            {count} angle{count === 1 ? "" : "s"}, one instant
          </p>
        </div>
        <div className="flex items-center gap-2">
          {multi && (
            <button
              type="button"
              onClick={() => setGrid((g) => !g)}
              aria-label={grid ? "Single angle view" : "See all angles"}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 font-mono text-xs uppercase tracking-[0.12em] text-foreground hover:bg-secondary"
            >
              {grid ? <Maximize2 className="size-4" /> : <LayoutGrid className="size-4" />}
              <span className="hidden sm:inline">{grid ? "single" : "all angles"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close moment"
            className="inline-flex size-10 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2">
        {count === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Mascot size={80} />
            <p className="font-mono text-sm text-muted-foreground">
              no frames arrived for this moment
            </p>
          </div>
        ) : grid && multi ? (
          // ---- grid: every angle of the instant at once ----
          <div
            className="grid h-full w-full max-w-4xl content-center gap-2 overflow-y-auto py-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {media.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setIndex(i);
                  setGrid(false);
                }}
                className="group relative aspect-square overflow-hidden rounded-md border border-border"
                aria-label={`Angle ${i + 1} by ${m.displayName}`}
              >
                <img
                  src={api.mediaUrl(code, m.id)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute bottom-1 left-1 rounded-sm bg-background/70 px-1.5 py-0.5 font-mono text-[0.6rem] text-foreground backdrop-blur-sm">
                  {i + 1} · {m.displayName}
                </span>
              </button>
            ))}
          </div>
        ) : (
          // ---- single: one angle, smooth crossfade ----
          <>
            {multi && (
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous angle"
                className="absolute left-2 z-10 hidden size-11 place-items-center rounded-full border border-border bg-card/80 hover:bg-secondary sm:grid"
              >
                <ChevronLeft className="size-5" />
              </button>
            )}

            <div className="relative h-full w-full max-w-3xl">
              <AnimatePresence>
                <motion.img
                  key={current.id}
                  src={api.mediaUrl(code, current.id)}
                  alt={`Angle by ${current.displayName}`}
                  drag={multi ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.18}
                  onDragEnd={multi ? onDragEnd : undefined}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                  className="absolute inset-0 m-auto max-h-full max-w-full rounded-lg border border-border object-contain shadow-2xl"
                  style={{ cursor: multi ? "grab" : "default" }}
                />
              </AnimatePresence>
            </div>

            {multi && (
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next angle"
                className="absolute right-2 z-10 hidden size-11 place-items-center rounded-full border border-border bg-card/80 hover:bg-secondary sm:grid"
              >
                <ChevronRight className="size-5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* caption */}
      {count > 0 && current && !grid && (
        <div className="px-5 pb-3 pt-1 text-center">
          <p className="font-mono text-sm">
            <span className="text-foreground">{current.displayName}</span>
            <span className="text-muted-foreground"> · angle {index + 1}/{count}</span>
          </p>
        </div>
      )}

      {/* thumbnails (single mode) */}
      {multi && !grid && (
        <div className="flex items-center gap-2 overflow-x-auto border-t border-border px-5 py-3">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`View angle ${i + 1}`}
              aria-current={i === index}
              className={`size-12 shrink-0 overflow-hidden rounded-sm border-2 ${
                i === index ? "border-moment" : "border-border opacity-70"
              }`}
            >
              <img
                src={api.mediaUrl(code, m.id)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
