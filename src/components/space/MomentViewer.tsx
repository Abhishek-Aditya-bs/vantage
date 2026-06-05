/**
 * Moment viewer — the multi-angle artifact. Shows every frame captured at the
 * same instant; a big stage "spins" through the angles (auto-advance + manual
 * prev/next/swipe), with a thumbnail contact-sheet below. Fires PixelConfetti
 * once on open to celebrate completion.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight, X, Play, Pause } from "lucide-react";
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
  const [playing, setPlaying] = useState(true);
  const [showConfetti, setShowConfetti] = useState(true);
  const count = media.length;

  const go = useCallback(
    (dir: number) => {
      if (count === 0) return;
      setIndex((i) => (i + dir + count) % count);
    },
    [count],
  );

  // auto-"spin" through angles
  useEffect(() => {
    if (!playing || count <= 1) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), 1400);
    return () => window.clearInterval(id);
  }, [playing, count]);

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
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const dragHandled = useRef(false);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (dragHandled.current) return;
    if (info.offset.x < -60) go(1);
    else if (info.offset.x > 60) go(-1);
  };

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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close moment"
          className="inline-flex size-10 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        {count === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Mascot size={80} />
            <p className="font-mono text-sm text-muted-foreground">
              no frames arrived for this moment
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous angle"
              className="absolute left-2 z-10 hidden size-11 place-items-center rounded-full border border-border bg-card/80 hover:bg-secondary sm:grid"
            >
              <ChevronLeft className="size-5" />
            </button>

            <AnimatePresence mode="popLayout" initial={false}>
              <motion.img
                key={current.id}
                src={api.mediaUrl(code, current.id)}
                alt={`Angle by ${current.displayName}`}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={onDragEnd}
                initial={{ opacity: 0, scale: 0.96, rotateY: 12 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.97, rotateY: -12 }}
                transition={{ duration: 0.32, ease: "easeInOut" }}
                className="max-h-full max-w-full cursor-grab rounded-lg border border-border object-contain shadow-2xl active:cursor-grabbing"
              />
            </AnimatePresence>

            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next angle"
              className="absolute right-2 z-10 hidden size-11 place-items-center rounded-full border border-border bg-card/80 hover:bg-secondary sm:grid"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {/* caption + controls */}
      {count > 0 && (
        <div className="px-5 pb-3 pt-2 text-center">
          <p className="font-mono text-sm">
            <span className="text-foreground">{current.displayName}</span>
            <span className="text-muted-foreground">
              {" "}
              · angle {index + 1}/{count}
            </span>
          </p>
        </div>
      )}

      {/* contact-sheet thumbnails */}
      {count > 1 && (
        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause spin" : "Play spin"}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-secondary"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <div className="flex gap-2 overflow-x-auto pb-1">
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
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
