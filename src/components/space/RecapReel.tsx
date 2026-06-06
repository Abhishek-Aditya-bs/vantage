/**
 * Recap reel — calm, not strobing. A title card opens it, then:
 *   • Moments  → a held multi-angle "moment card" (every angle of one instant)
 *   • loose photos → a brief Ken-Burns montage
 *
 * Export builds a real video (title card → cross-faded photos → Vantage outro)
 * and offers it to the OS share sheet ("Save to Photos / gallery") on mobile,
 * falling back to a download on desktop. The cinematic server render (ffmpeg)
 * is used when RENDER_MODE=server.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, Pause, Play, Volume2, VolumeX, Share2, Aperture } from "lucide-react";
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
  | { kind: "title"; id: string; t: number }
  | { kind: "moment"; id: string; frames: MediaMeta[]; t: number }
  | { kind: "slide"; id: string; frame: MediaMeta; t: number };

const SLIDE_MS = 2600;
const MOMENT_MS = 4200;
const TITLE_MS = 3200;

const momentCols = (n: number): number => (n <= 4 ? 2 : n <= 9 ? 3 : 4);

export function RecapReel({ code, spaceName, media, onClose }: RecapReelProps) {
  // Timeline: a title card, then chronological Moments (multi-angle cards) + photos.
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
      else loose.push(...sorted);
    }
    for (const f of loose) segs.push({ kind: "slide", id: f.id, frame: f, t: f.createdAt });
    segs.sort((a, b) => a.t - b.t);
    if (segs.length > 0) segs.unshift({ kind: "title", id: "__title__", t: -Infinity });
    return segs;
  }, [media]);

  const [seg, setSeg] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const audioRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);
  const current = segments[seg];
  const photoCount = media.length;

  useEffect(() => {
    if (!playing || segments.length === 0) return;
    const dur = current?.kind === "title" ? TITLE_MS : current?.kind === "moment" ? MOMENT_MS : SLIDE_MS;
    const id = window.setTimeout(() => setSeg((s) => (s + 1) % segments.length), dur);
    return () => window.clearTimeout(id);
  }, [playing, seg, segments, current]);

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

  const reelFrames = useMemo(() => [...media].sort((a, b) => a.createdAt - b.createdAt), [media]);

  const exportReel = useCallback(async () => {
    if (exporting || reelFrames.length === 0) return;
    setExporting(true);
    setExportProgress(0);
    try {
      let out: { blob: Blob; filename: string } | null = null;
      const server = await api.requestServerRecap(code);
      if (server.mode === "server") {
        const blob = await fetch(server.url).then((r) => r.blob());
        URL.revokeObjectURL(server.url);
        out = { blob, filename: "vantage-recap.mp4" };
      } else {
        out = await renderRecapVideo(code, spaceName, reelFrames, (p) => setExportProgress(p));
      }
      if (out) await saveOrShare(out.blob, out.filename);
    } catch {
      /* best-effort — never block the reel */
    } finally {
      setExporting(false);
    }
  }, [exporting, code, spaceName, reelFrames]);

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
        ) : current.kind === "title" ? (
          // professional title card
          <motion.div
            key="title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 grid place-items-center p-8 text-center"
          >
            <div>
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.42em] text-muted-foreground">recap</p>
              <h2
                className="mx-auto mt-5 max-w-[14ch] font-display font-semibold leading-[1.02] tracking-[-0.03em] text-white"
                style={{ fontSize: "clamp(2.2rem, 8vw, 5rem)" }}
              >
                {spaceName}
              </h2>
              <p className="mt-5 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-muted-foreground">
                {photoCount} photo{photoCount === 1 ? "" : "s"} · every angle, one instant
              </p>
            </div>
          </motion.div>
        ) : current.kind === "moment" ? (
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

        {/* label overlay (not on the title card) */}
        {current && current.kind !== "title" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
            {current.kind === "moment" ? (
              <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-moment">
                <Aperture className="size-4" />
                the moment · {current.frames.length} angles · one instant
              </p>
            ) : (
              <>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">recap · {spaceName}</p>
                <p className="mt-1 font-display text-lg font-semibold text-white">{current.frame.displayName}</p>
              </>
            )}
          </div>
        )}

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
            <AsciiProgress value={exportProgress} width={12} label="Rendering" />
          ) : (
            <span title="Render this recap and save it to your gallery (or download on desktop)">
              <button
                type="button"
                onClick={exportReel}
                disabled={reelFrames.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3.5 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Share2 className="size-4" />
                Save reel
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

/* --------------------------------------------- save to gallery / download --- */

/** Offer the file to the OS share sheet ("Save to Photos/gallery"); else download. */
async function saveOrShare(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  try {
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] }) &&
      typeof navigator.share === "function"
    ) {
      await navigator.share({ files: [file], title: "Vantage recap", text: "My Vantage recap" });
      return;
    }
  } catch {
    /* user cancelled or the gesture expired → fall through to download */
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* --------------------------------------------- on-device recap video render -- */

const VID_W = 1280;
const VID_H = 720;
const FPS = 30;
const FRAME_MS = 1000 / FPS;
const MAX_EXPORT_FRAMES = 40; // bound length/memory; full quality is the server render

/** Render the recap to a video Blob: title card → cross-faded photos → outro. */
async function renderRecapVideo(
  code: string,
  spaceName: string,
  reel: MediaMeta[],
  onProgress: (p: number) => void,
): Promise<{ blob: Blob; filename: string } | null> {
  if (reel.length === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = VID_W;
  canvas.height = VID_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const supportsRecorder =
    typeof MediaRecorder !== "undefined" &&
    (MediaRecorder.isTypeSupported("video/mp4") || MediaRecorder.isTypeSupported("video/webm"));
  if (!supportsRecorder) return null;
  const mime = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";

  // make sure the brand fonts are ready before we draw text to canvas
  try {
    await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
  } catch {
    /* ignore */
  }

  // sample evenly so the reel represents the whole event without running forever
  const picks = sampleEvenly(reel, MAX_EXPORT_FRAMES);

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (recorder.onstop = () => res()));
  recorder.start();

  // 1) title card
  await playCard(ctx, { eyebrow: "Recap", title: spaceName, sub: "every angle · one instant" }, 2400);

  // 2) cross-faded photo montage
  let prev: HTMLImageElement | null = null;
  for (let i = 0; i < picks.length; i++) {
    let cur: HTMLImageElement;
    try {
      cur = await loadImage(api.mediaUrl(code, picks[i].id));
    } catch {
      continue;
    }
    // crossfade in (~12 frames)
    for (let f = 0; f <= 12; f++) {
      const a = f / 12;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, VID_W, VID_H);
      if (prev) {
        ctx.globalAlpha = 1 - a;
        drawContain(ctx, prev);
      }
      ctx.globalAlpha = a;
      drawContain(ctx, cur);
      ctx.globalAlpha = 1;
      await wait(FRAME_MS);
    }
    // hold (~22 frames)
    for (let f = 0; f < 22; f++) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, VID_W, VID_H);
      drawContain(ctx, cur);
      await wait(FRAME_MS);
    }
    prev = cur;
    onProgress((i + 1) / picks.length);
  }

  // 3) outro card
  await playCard(ctx, { eyebrow: "", title: "Vantage", sub: "every angle, one instant" }, 1800);

  recorder.stop();
  await done;

  const blob = new Blob(chunks, { type: mime });
  return { blob, filename: `vantage-recap.${mime === "video/mp4" ? "mp4" : "webm"}` };
}

/* ------------------------------------------------------ canvas draw helpers - */

function spaced(s: string): string {
  return s.toUpperCase().split("").join("  ");
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, weight: string, family: string, start: number): number {
  let px = start;
  ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && px > 24) {
    px -= 4;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  opts: { eyebrow: string; title: string; sub: string; alpha: number },
): void {
  ctx.save();
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, VID_W, VID_H);
  ctx.globalAlpha = Math.max(0, Math.min(1, opts.alpha));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = VID_W / 2;
  const cy = VID_H / 2;

  if (opts.eyebrow) {
    ctx.fillStyle = "#9a9a9a";
    ctx.font = "500 22px 'Geist Mono Variable', ui-monospace, monospace";
    ctx.fillText(spaced(opts.eyebrow), cx, cy - 88);
  }
  const tpx = fitFont(ctx, opts.title, VID_W * 0.82, "600", "'Geist Variable', system-ui, sans-serif", 88);
  ctx.fillStyle = "#fafafa";
  ctx.font = `600 ${tpx}px 'Geist Variable', system-ui, sans-serif`;
  ctx.fillText(opts.title, cx, cy + 4);
  ctx.fillStyle = "#8a8a8a";
  ctx.font = "400 22px 'Geist Mono Variable', ui-monospace, monospace";
  ctx.fillText(spaced(opts.sub), cx, cy + 78);
  ctx.restore();
}

/** Play a card with a fade in/out for `durMs`. */
async function playCard(
  ctx: CanvasRenderingContext2D,
  opts: { eyebrow: string; title: string; sub: string },
  durMs: number,
): Promise<void> {
  const FADE = 380;
  for (let t = 0; t <= durMs; t += FRAME_MS) {
    const a = t < FADE ? t / FADE : t > durMs - FADE ? (durMs - t) / FADE : 1;
    drawCard(ctx, { ...opts, alpha: a });
    await wait(FRAME_MS);
  }
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement): void {
  const scale = Math.min(VID_W / img.width, VID_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (VID_W - w) / 2, (VID_H - h) / 2, w, h);
}

function sampleEvenly<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const step = arr.length / max;
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  return out;
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

function wait(ms: number): Promise<void> {
  return new Promise((res) => window.setTimeout(res, ms));
}
