/**
 * Recap reel — calm, not strobing. It segments the space into:
 *   • Moments  → a held multi-angle "moment card" (every angle of one instant)
 *   • loose photos → a brief Ken-Burns montage
 * so the recap features the multi-angle moments without flashing. Optional
 * ambient pad, and an "Export MP4" path (server render when enabled — the
 * cinematic motion lives there — else an on-device fallback).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, Pause, Play, Volume2, VolumeX, Download, Aperture } from "lucide-react";
import type { MediaMeta } from "@shared/protocol";
import { api } from "@/lib/api";
import { AsciiProgress } from "@/components/brand/AsciiProgress";
import { Mascot } from "@/components/brand/Mascot";

interface RecapReelProps {
  code: string;
  spaceName: string;
  media: MediaMeta[];
  onClose: () => void;
}

type Segment =
  | { kind: "moment"; id: string; frames: MediaMeta[]; t: number }
  | { kind: "slide"; id: string; frame: MediaMeta; t: number };

const SLIDE_MS = 2600;
const MOMENT_MS = 4200;

const momentCols = (n: number): number => (n <= 4 ? 2 : n <= 9 ? 3 : 4);

export function RecapReel({ code, spaceName, media, onClose }: RecapReelProps) {
  // Build the segment timeline: multi-angle Moments become bullet-time; the rest
  // are single slides. Sorted chronologically so the recap reads as a story.
  const segments = useMemo<Segment[]>(() => {
    const byMoment = new Map<string, MediaMeta[]>();
    const loose: MediaMeta[] = [];
    for (const m of media) {
      if (m.kind === "moment" && m.momentId) {
        const arr = byMoment.get(m.momentId) ?? [];
        arr.push(m);
        byMoment.set(m.momentId, arr);
      } else {
        loose.push(m);
      }
    }
    const segs: Segment[] = [];
    for (const [id, frames] of byMoment) {
      const sorted = [...frames].sort((a, b) => a.createdAt - b.createdAt);
      if (sorted.length >= 2) segs.push({ kind: "moment", id, frames: sorted, t: sorted[0].createdAt });
      else loose.push(...sorted); // a 1-angle "moment" is just a photo
    }
    for (const f of loose) segs.push({ kind: "slide", id: f.id, frame: f, t: f.createdAt });
    return segs.sort((a, b) => a.t - b.t);
  }, [media]);

  const [seg, setSeg] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const audioRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);
  const current = segments[seg];

  // advance segments (Moments linger a touch longer so the angle grid reads)
  useEffect(() => {
    if (!playing || segments.length === 0) return;
    const dur = current?.kind === "moment" ? MOMENT_MS : SLIDE_MS;
    const id = window.setTimeout(() => setSeg((s) => (s + 1) % segments.length), dur);
    return () => window.clearTimeout(id);
  }, [playing, seg, segments, current]);

  // ambient WebAudio pad — only while unmuted + playing
  useEffect(() => {
    if (muted || !playing) {
      audioRef.current?.stop();
      audioRef.current = null;
      return;
    }
    audioRef.current = startAmbientPad();
    return () => {
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, [muted, playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reelFrames = useMemo(
    () => [...media].sort((a, b) => a.createdAt - b.createdAt),
    [media],
  );

  const exportMp4 = useCallback(async () => {
    if (exporting || reelFrames.length === 0) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const server = await api.requestServerRecap(code);
      if (server.mode === "server") {
        triggerDownload(server.url, "vantage-recap.mp4");
        URL.revokeObjectURL(server.url);
      } else {
        await exportReelToMp4(code, reelFrames, (p) => setExportProgress(p));
      }
    } catch {
      /* best-effort */
    } finally {
      setExporting(false);
    }
  }, [exporting, code, reelFrames]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      role="dialog"
      aria-modal="true"
      aria-label="Recap reel"
    >
      {/* stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        {segments.length === 0 || !current ? (
          <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
            <Mascot size={80} />
            <p className="font-mono text-sm">nothing to recap yet</p>
          </div>
        ) : current.kind === "moment" ? (
          // calm multi-angle "moment card": every angle of the instant at once
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 grid place-items-center p-6 sm:p-10"
          >
            <div
              className="grid w-full max-w-3xl gap-2"
              style={{ gridTemplateColumns: `repeat(${momentCols(current.frames.length)}, minmax(0,1fr))` }}
            >
              {current.frames.slice(0, 9).map((m) => (
                <div key={m.id} className="aspect-square overflow-hidden rounded-md border border-white/15">
                  <img src={api.mediaUrl(code, m.id)} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.img
              key={current.frame.id}
              src={api.mediaUrl(code, current.frame.id)}
              alt={`Recap frame by ${current.frame.displayName}`}
              initial={{ opacity: 0, scale: 1.0 }}
              animate={{ opacity: 1, scale: 1.08 }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.7, ease: "easeInOut" },
                scale: { duration: SLIDE_MS / 1000, ease: "easeInOut" },
              }}
              className="absolute inset-0 h-full w-full object-contain"
            />
          </AnimatePresence>
        )}

        {/* label overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
          {current?.kind === "moment" ? (
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-moment">
              <Aperture className="size-4" />
              the moment · {current.frames.length} angles · one instant
            </p>
          ) : (
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              recap · {spaceName}
            </p>
          )}
          {current?.kind === "slide" && (
            <p className="mt-1 font-display text-lg font-semibold text-white">
              {current.frame.displayName}
            </p>
          )}
        </div>

        {/* segment progress ticks */}
        {segments.length > 0 && (
          <div className="absolute left-0 right-0 top-0 flex gap-1 p-3">
            {segments.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 flex-1 rounded-full ${
                  i < seg ? "bg-primary" : i === seg ? (s.kind === "moment" ? "bg-moment" : "bg-primary") : "bg-white/25"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* controls */}
      <div className="flex items-center justify-between gap-4 border-t border-border bg-card px-5 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
            className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-secondary"
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Enable ambient sound" : "Mute ambient sound"}
            className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-secondary"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {exporting ? (
            <AsciiProgress value={exportProgress} width={12} label="Exporting" />
          ) : (
            <span title="Render this recap to MP4 — server-side when enabled, otherwise in your browser">
              <button
                type="button"
                onClick={exportMp4}
                disabled={reelFrames.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3.5 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="size-4" />
                Export MP4
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close recap"
            className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-secondary"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}

/* ----------------------------------------------------- ambient WebAudio pad */

function startAmbientPad(): { ctx: AudioContext; stop: () => void } {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.5);

  const freqs = [110, 164.81];
  const oscs = freqs.map((f) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    o.connect(g).connect(master);
    o.start();
    return o;
  });

  return {
    ctx,
    stop: () => {
      try {
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        oscs.forEach((o) => o.stop(ctx.currentTime + 0.5));
        window.setTimeout(() => ctx.close().catch(() => undefined), 700);
      } catch {
        /* ignore */
      }
    },
  };
}

/* --------------------------------------------------- best-effort MP4 export */

async function exportReelToMp4(
  code: string,
  reel: MediaMeta[],
  onProgress: (p: number) => void,
): Promise<void> {
  if (reel.length === 0) return;
  const W = 1280;
  const H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const stream = canvas.captureStream(30);
  const supportsRecorder =
    typeof MediaRecorder !== "undefined" &&
    (MediaRecorder.isTypeSupported("video/mp4") || MediaRecorder.isTypeSupported("video/webm"));
  if (!supportsRecorder) return;

  const mime = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (recorder.onstop = () => res()));
  recorder.start();

  for (let i = 0; i < reel.length; i++) {
    const img = await loadImage(api.mediaUrl(code, reel[i].id));
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawContain(ctx, img, W, H);
    onProgress((i + 1) / reel.length);
    await wait(1000);
  }

  recorder.stop();
  await done;

  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `vantage-recap.${mime === "video/mp4" ? "mp4" : "webm"}`);
  URL.revokeObjectURL(url);
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number): void {
  const scale = Math.min(W / img.width, H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function wait(ms: number): Promise<void> {
  return new Promise((res) => window.setTimeout(res, ms));
}
