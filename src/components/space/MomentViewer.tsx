/**
 * Moment viewer — the multi-angle artifact, shown as BULLET-TIME: the same
 * instant captured by every phone, swept fast and orbitable by drag, so time
 * appears frozen while the camera flies around the subject. A thumbnail
 * contact-sheet pins specific angles. Fires PixelConfetti once on open.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, X, Play, Pause, Rotate3d } from "lucide-react";
import type { MediaMeta } from "@shared/protocol";
import { api } from "@/lib/api";
import { PixelConfetti } from "@/components/brand/PixelConfetti";
import { Mascot } from "@/components/brand/Mascot";
import { BulletTime } from "@/components/space/BulletTime";

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
  const multi = count > 1;

  const go = useCallback(
    (dir: number) => {
      if (count === 0) return;
      setPlaying(false);
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
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

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
      aria-label="Moment — bullet-time multi-angle view"
    >
      {showConfetti && <PixelConfetti seed={momentId} />}

      {/* header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-moment">
            ● the moment · bullet-time
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

            <div className="relative h-full w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-black/20">
              <BulletTime
                code={code}
                frames={media}
                index={index}
                onIndexChange={setIndex}
                playing={playing && multi}
              />
              {multi && (
                <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground backdrop-blur-sm">
                  <Rotate3d className="size-3.5" />
                  drag to orbit
                </div>
              )}
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
      {count > 0 && current && (
        <div className="px-5 pb-3 pt-2 text-center">
          <p className="font-mono text-sm">
            <span className="text-foreground">{current.displayName}</span>
            <span className="text-muted-foreground"> · angle {index + 1}/{count}</span>
          </p>
        </div>
      )}

      {/* contact-sheet thumbnails */}
      {multi && (
        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause orbit" : "Play orbit"}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-secondary"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {media.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setIndex(i);
                }}
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
