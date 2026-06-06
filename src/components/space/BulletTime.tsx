/**
 * BulletTime — the thing a single camera can't do.
 *
 * A Moment is the SAME instant captured from every phone in the room. Sequencing
 * those angles fast (with a ping-pong sweep) and letting you DRAG to scrub makes
 * time appear to freeze while the camera orbits the subject — the "bullet-time"
 * / multi-cam freeze-frame effect (think The Matrix, NBA replays). All frames are
 * preloaded and stacked so switching is instant; nothing decodes mid-sweep.
 *
 * Controlled: the parent owns `index` (so thumbnails / prev-next stay in sync);
 * this component drives the auto-sweep and the drag-orbit, reporting back.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { MediaMeta } from "@shared/protocol";
import { cn } from "@/lib/utils";

interface BulletTimeProps {
  code: string;
  frames: MediaMeta[];
  index: number;
  onIndexChange: (i: number) => void;
  /** auto ping-pong sweep when not being dragged */
  playing?: boolean;
  /** ms per angle during the auto sweep */
  sweepMs?: number;
  className?: string;
}

export function BulletTime({
  code,
  frames,
  index,
  onIndexChange,
  playing = true,
  sweepMs = 95,
  className,
}: BulletTimeProps) {
  const n = frames.length;
  const idxRef = useRef(index);
  idxRef.current = index;
  const dirRef = useRef(1);
  const draggingRef = useRef(false);
  const resumeAtRef = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const [settled, setSettled] = useState(0); // images that finished loading/erroring
  const ready = settled >= n;

  // auto-sweep (ping-pong), paused while dragging or shortly after a drag
  useEffect(() => {
    if (!playing || !ready || n <= 1) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      if (draggingRef.current || Date.now() < resumeAtRef.current) return;
      let next = idxRef.current + dirRef.current;
      if (next >= n) {
        dirRef.current = -1;
        next = Math.max(0, n - 2);
      } else if (next < 0) {
        dirRef.current = 1;
        next = Math.min(n - 1, 1);
      }
      onIndexChange(next);
    }, sweepMs);
    return () => window.clearInterval(id);
  }, [playing, ready, n, sweepMs, onIndexChange]);

  // drag-to-orbit
  function onPointerDown(e: React.PointerEvent) {
    if (n <= 1) return;
    draggingRef.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const startX = e.clientX;
    const startIdx = idxRef.current;
    const width = boxRef.current?.clientWidth ?? 320;
    const pxPerFrame = Math.max(10, width / (n * 1.15));

    const move = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      let i = Math.round(startIdx + delta / pxPerFrame);
      i = Math.max(0, Math.min(n - 1, i));
      if (i !== idxRef.current) onIndexChange(i);
    };
    const up = () => {
      draggingRef.current = false;
      resumeAtRef.current = Date.now() + 1500; // let the user look before resuming
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      className={cn(
        "relative h-full w-full touch-none select-none",
        n > 1 && "cursor-grab active:cursor-grabbing",
        className,
      )}
      role="group"
      aria-label="Bullet-time — drag to orbit the moment"
    >
      {frames.map((m, i) => (
        <img
          key={m.id}
          src={api.mediaUrl(code, m.id)}
          alt={`Angle ${i + 1} by ${m.displayName}`}
          draggable={false}
          onLoad={() => setSettled((s) => s + 1)}
          onError={() => setSettled((s) => s + 1)}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          style={{ opacity: i === index ? 1 : 0, transition: "opacity 55ms linear" }}
        />
      ))}
      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono text-xs text-muted-foreground">buffering angles…</span>
        </div>
      )}
    </div>
  );
}
