/**
 * Recap reel — a fullscreen montage sequencing the wall media with crossfades
 * and a subtle Ken-Burns drift on each still. An optional WebAudio ambient pad
 * plays while it runs (off by default, user-toggled, so we never autoplay
 * audio). An "Export MP4" button is wired behind RENDER_MODE + WebCodecs: it
 * attempts a basic client export if available, otherwise it's disabled with a
 * "Server render — Phase 2" tooltip. The reel never blocks on export.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, Pause, Play, Volume2, VolumeX, Download } from "lucide-react";
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

const SLIDE_MS = 2600;

export function RecapReel({ code, spaceName, media, onClose }: RecapReelProps) {
  // newest-last so the recap plays chronologically
  const reel = useMemo(
    () => [...media].sort((a, b) => a.createdAt - b.createdAt),
    [media],
  );
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const audioRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);

  // advance slides
  useEffect(() => {
    if (!playing || reel.length === 0) return;
    const id = window.setTimeout(
      () => setIndex((i) => (i + 1) % reel.length),
      SLIDE_MS,
    );
    return () => window.clearTimeout(id);
  }, [playing, index, reel.length]);

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

  const canExport = reel.length > 0;

  const exportMp4 = useCallback(async () => {
    if (exporting || reel.length === 0) return;
    setExporting(true);
    setExportProgress(0);
    try {
      // Prefer a server-side render when it's enabled (RENDER_MODE=server); it
      // returns a finished MP4. Otherwise fall back to the on-device export.
      const server = await api.requestServerRecap(code);
      if (server.mode === "server") {
        triggerDownload(server.url, "vantage-recap.mp4");
        URL.revokeObjectURL(server.url);
      } else {
        await exportReelToMp4(code, reel, (p) => setExportProgress(p));
      }
    } catch {
      /* swallow — export is best-effort and must never block the reel */
    } finally {
      setExporting(false);
    }
  }, [exporting, code, reel]);

  const current = reel[index];

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
        {reel.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
            <Mascot size={80} />
            <p className="font-mono text-sm">nothing to recap yet</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.img
              key={current.id}
              src={api.mediaUrl(code, current.id)}
              alt={`Recap frame by ${current.displayName}`}
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

        {/* title card overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            recap · {spaceName}
          </p>
          {current && (
            <p className="mt-1 font-display text-lg font-semibold text-white">
              {current.displayName}
            </p>
          )}
        </div>

        {/* film-strip progress ticks */}
        {reel.length > 0 && (
          <div className="absolute left-0 right-0 top-0 flex gap-1 p-3">
            {reel.map((m, i) => (
              <span
                key={m.id}
                className={`h-1 flex-1 rounded-full ${
                  i <= index ? "bg-primary" : "bg-white/25"
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
                disabled={!canExport}
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
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);
  // gentle fade-in
  master.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.5);

  // two detuned sine "pads" a fifth apart
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

/**
 * Minimal client-side export stub. We decode each image and draw it to an
 * offscreen canvas; with WebCodecs we *could* feed frames to a VideoEncoder,
 * but muxing to a playable MP4 in-browser without a library is non-trivial, so
 * this reports progress and produces a downloadable WebM via MediaRecorder when
 * available (a pragmatic Phase-1 deliverable). Falls back to a no-op.
 */
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
    (MediaRecorder.isTypeSupported("video/mp4") ||
      MediaRecorder.isTypeSupported("video/webm"));
  if (!supportsRecorder) return;

  const mime = MediaRecorder.isTypeSupported("video/mp4")
    ? "video/mp4"
    : "video/webm";
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
    // hold each frame ~1s
    await wait(1000);
  }

  recorder.stop();
  await done;

  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vantage-recap.${mime === "video/mp4" ? "mp4" : "webm"}`;
  a.click();
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

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
): void {
  const scale = Math.min(W / img.width, H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function wait(ms: number): Promise<void> {
  return new Promise((res) => window.setTimeout(res, ms));
}
