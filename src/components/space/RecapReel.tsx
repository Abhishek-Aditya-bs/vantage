/**
 * Recap reel — a vertical, story-format playback of a space.
 *   • Title card → chronological Moments (multi-angle cards) + Ken-Burns photos → outro.
 *   • Tap the right side to go forward, the left side to go back, the centre to
 *     pause/resume — exactly like Instagram stories.
 *   • Optional synthesized lo-fi soundtrack (the unmute toggle).
 *
 * Export builds a REAL 1080×1920 vertical video that mirrors this preview frame
 * for frame (blurred backdrop + photo + captions + progress + moment collages),
 * optionally with the soundtrack baked in, then opens a result view to save it
 * to the gallery (mobile share sheet) / download + watch full-screen (web).
 *
 * Preview and export share one timeline (buildSegments) so what you see is what
 * you save. The cinematic server render (ffmpeg) is used when RENDER_MODE=server.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  X,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Share2,
  Aperture,
  Download,
  Maximize,
  Check,
} from "lucide-react";
import type { MediaMeta } from "@shared/protocol";
import { api } from "@/lib/api";
import {
  buildSegments,
  momentCols,
  kenBurns,
  enterStyle,
  TIMING,
  type Segment,
  type EnterStyle,
} from "@/lib/recap";
import { createBeats, type BeatHandle } from "@/lib/beats";
import { AsciiProgress } from "@/components/brand/AsciiProgress";
import { Mascot } from "@/components/brand/Mascot";

interface RecapReelProps {
  code: string;
  spaceName: string;
  media: MediaMeta[];
  onClose: () => void;
}

interface ExportResult {
  url: string;
  blob: Blob;
  filename: string;
}

export function RecapReel({ code, spaceName, media, onClose }: RecapReelProps) {
  const segments = useMemo<Segment[]>(() => buildSegments(media), [media]);

  const [seg, setSeg] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [result, setResult] = useState<ExportResult | null>(null);

  const liveMusicRef = useRef<{
    ctx: AudioContext;
    beat: BeatHandle;
    audioEl?: HTMLAudioElement;
  } | null>(null);
  const [musicStyle, setMusicStyle] = useState<string | null>(null);
  const current = segments[seg];
  const photoCount = media.length;
  const musicSeed = useMemo(() => spaceName.length + photoCount, [spaceName, photoCount]);

  /* ---------------------------------------------------------- navigation */

  const goNext = useCallback(() => {
    setSeg((s) => {
      if (s >= segments.length - 1) {
        onClose();
        return s;
      }
      return s + 1;
    });
  }, [segments.length, onClose]);

  const goPrev = useCallback(() => setSeg((s) => Math.max(0, s - 1)), []);

  // auto-advance; stops (pauses) at the end rather than looping
  useEffect(() => {
    if (!playing || segments.length === 0) return;
    const dur =
      current?.kind === "title"
        ? TIMING.title
        : current?.kind === "moment"
          ? TIMING.moment
          : TIMING.slide;
    const id = window.setTimeout(() => {
      setSeg((s) => {
        if (s >= segments.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, dur);
    return () => window.clearTimeout(id);
  }, [playing, seg, segments, current]);

  /* ---------------------------------------------------------- soundtrack */

  const stopLiveMusic = useCallback(() => {
    const m = liveMusicRef.current;
    if (!m) return;
    liveMusicRef.current = null;
    setMusicStyle(null);
    try {
      m.beat.stop();
      if (m.audioEl) {
        m.audioEl.pause();
        m.audioEl.srcObject = null;
      }
      window.setTimeout(() => m.ctx.close().catch(() => undefined), 700);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMusic = useCallback(async () => {
    if (musicOn) {
      setMusicOn(false);
      stopLiveMusic();
      return;
    }
    // Create + resume the AudioContext INSIDE this click so iOS lets it sound.
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctor();
      await ctx.resume();
      let beat: BeatHandle;
      let audioEl: HTMLAudioElement | undefined;
      // Route through an <audio> element (media channel) so it stays audible on
      // iOS even with the ringer/silent switch ON — WebAudio straight to the
      // speakers is muted by that switch.
      if (typeof ctx.createMediaStreamDestination === "function") {
        const dest = ctx.createMediaStreamDestination();
        beat = createBeats(ctx, dest, { seed: musicSeed, gain: 0.85 });
        audioEl = new Audio();
        audioEl.srcObject = dest.stream;
        audioEl.setAttribute("playsinline", "");
        audioEl.autoplay = true;
        await audioEl.play().catch(() => undefined);
      } else {
        beat = createBeats(ctx, ctx.destination, { seed: musicSeed, gain: 0.85 });
      }
      liveMusicRef.current = { ctx, beat, audioEl };
      setMusicStyle(beat.style);
      setMusicOn(true);
    } catch {
      /* audio unavailable — leave muted */
    }
  }, [musicOn, musicSeed, stopLiveMusic]);

  // stop the soundtrack when the reel unmounts
  useEffect(() => () => stopLiveMusic(), [stopLiveMusic]);

  /* ---------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  /* ---------------------------------------------------------- export */

  const exportReel = useCallback(async () => {
    if (exporting || media.length === 0) return;
    setExporting(true);
    setExportProgress(0);
    try {
      let out: ExportResult | null = null;
      const server = await api.requestServerRecap(code);
      if (server.mode === "server") {
        const blob = await fetch(server.url).then((r) => r.blob());
        URL.revokeObjectURL(server.url);
        out = { url: URL.createObjectURL(blob), blob, filename: "vantage-recap.mp4" };
      } else {
        const rendered = await renderRecapVideo(code, spaceName, media, {
          music: musicOn,
          seed: musicSeed,
          onProgress: setExportProgress,
        });
        if (rendered)
          out = {
            url: URL.createObjectURL(rendered.blob),
            blob: rendered.blob,
            filename: rendered.filename,
          };
      }
      // Don't auto-save: surface a result so the user saves on a fresh gesture
      // (iOS only honours the share sheet from within a tap).
      if (out) {
        setPlaying(false);
        setResult(out);
      }
    } catch {
      /* best-effort — never block the reel */
    } finally {
      setExporting(false);
    }
  }, [exporting, code, spaceName, media, musicOn, musicSeed]);

  const closeResult = useCallback(() => {
    setResult((r) => {
      if (r) URL.revokeObjectURL(r.url);
      return null;
    });
  }, []);

  /* ---------------------------------------------------------- render */

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
        ) : (
          <AnimatePresence mode="popLayout">
            {current.kind === "title" ? (
              <TitleCard key="title" spaceName={spaceName} photoCount={photoCount} />
            ) : current.kind === "moment" ? (
              <MomentCollage key={current.id} code={code} frames={current.frames} />
            ) : (
              <SlideView key={current.frame.id} code={code} frame={current.frame} index={seg} />
            )}
          </AnimatePresence>
        )}

        {/* label overlay (not on the title card) */}
        {current && current.kind !== "title" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 to-transparent p-6 pb-7">
            {current.kind === "moment" ? (
              <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-moment">
                <Aperture className="size-4" />
                the moment · {current.frames.length} angles · one instant
              </p>
            ) : (
              <>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
                  recap · {spaceName}
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-white">
                  {current.frame.displayName}
                </p>
              </>
            )}
          </div>
        )}

        {/* segment progress ticks */}
        {segments.length > 0 && (
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex gap-1 p-3">
            {segments.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 flex-1 rounded-full ${
                  i < seg
                    ? "bg-primary"
                    : i === seg
                      ? s.kind === "moment"
                        ? "bg-moment"
                        : "bg-primary"
                      : "bg-white/25"
                }`}
              />
            ))}
          </div>
        )}

        {/* Instagram-style tap zones: ‹ back · pause · forward › */}
        {segments.length > 0 && !result && (
          <div className="absolute inset-0 z-20 flex">
            <button
              type="button"
              className="h-full w-[32%] cursor-default outline-none"
              onClick={goPrev}
              aria-label="Previous"
            />
            <button
              type="button"
              className="h-full w-[36%] cursor-default outline-none"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause" : "Play"}
            />
            <button
              type="button"
              className="h-full w-[32%] cursor-default outline-none"
              onClick={goNext}
              aria-label="Next"
            />
          </div>
        )}
      </div>

      {/* controls */}
      <div className="z-30 flex items-center justify-between gap-4 border-t border-border bg-card px-5 py-4">
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
            onClick={toggleMusic}
            aria-label={musicOn ? "Mute soundtrack" : "Play a random soundtrack"}
            aria-pressed={musicOn}
            title="Synthesized, royalty-free — a fresh groove each time"
            className={`inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-secondary ${
              musicOn ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {musicOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
          {musicOn && musicStyle && (
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
              ♪ {musicStyle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {exporting ? (
            <AsciiProgress value={exportProgress} width={12} label="Rendering" />
          ) : (
            <span title="Render this recap as a vertical video and save it to your gallery (or download on desktop)">
              <button
                type="button"
                onClick={exportReel}
                disabled={media.length === 0}
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

      {result && (
        <ResultView result={result} musicOn={musicOn} onClose={closeResult} />
      )}
    </motion.div>,
    document.body,
  );
}

/* ----------------------------------------------------- preview sub-views --- */

function TitleCard({ spaceName, photoCount }: { spaceName: string; photoCount: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="absolute inset-0 grid place-items-center p-8 text-center"
    >
      <div>
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.42em] text-muted-foreground">
          recap
        </p>
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
  );
}

function MomentCollage({ code, frames }: { code: string; frames: MediaMeta[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="absolute inset-0 grid place-items-center p-6 sm:p-10"
    >
      <div
        className="grid w-full max-w-md gap-2"
        style={{ gridTemplateColumns: `repeat(${momentCols(frames.length)}, minmax(0,1fr))` }}
      >
        {frames.slice(0, 9).map((m) => (
          <div
            key={m.id}
            className="aspect-square overflow-hidden rounded-md border border-white/15"
          >
            <img src={api.mediaUrl(code, m.id)} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function enterVariant(style: EnterStyle) {
  switch (style) {
    case "slide-left":
      return { initial: { opacity: 0, x: "8%" }, animate: { opacity: 1, x: 0 } };
    case "slide-right":
      return { initial: { opacity: 0, x: "-8%" }, animate: { opacity: 1, x: 0 } };
    case "slide-up":
      return { initial: { opacity: 0, y: "8%" }, animate: { opacity: 1, y: 0 } };
    case "zoom":
      return { initial: { opacity: 0, scale: 1.06 }, animate: { opacity: 1, scale: 1 } };
    default:
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
  }
}

function SlideView({ code, frame, index }: { code: string; frame: MediaMeta; index: number }) {
  const kb = kenBurns(index);
  const variant = enterVariant(enterStyle(index));
  const src = api.mediaUrl(code, frame.id);
  return (
    <motion.div
      className="absolute inset-0"
      initial={variant.initial}
      animate={variant.animate}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* blurred cover backdrop → full-bleed vertical, never tiny */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-[0.45]"
      />
      {/* the photo, contained, with a slow Ken-Burns move */}
      <motion.img
        src={src}
        alt={`Recap frame by ${frame.displayName}`}
        initial={{
          scale: kb.from.scale,
          x: `${kb.from.x * 100}%`,
          y: `${kb.from.y * 100}%`,
        }}
        animate={{
          scale: kb.to.scale,
          x: `${kb.to.x * 100}%`,
          y: `${kb.to.y * 100}%`,
        }}
        transition={{ duration: TIMING.slide / 1000, ease: "linear" }}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </motion.div>
  );
}

/* ------------------------------------------------- export result view ------ */

function canShareFiles(blob: Blob, filename: string): boolean {
  try {
    const file = new File([blob], filename, { type: blob.type });
    return (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] }) &&
      typeof navigator.share === "function"
    );
  } catch {
    return false;
  }
}

function ResultView({
  result,
  musicOn,
  onClose,
}: {
  result: ExportResult;
  musicOn: boolean;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [saved, setSaved] = useState(false);
  const shareable = useMemo(
    () => canShareFiles(result.blob, result.filename),
    [result],
  );

  const saveToGallery = useCallback(async () => {
    try {
      const file = new File([result.blob], result.filename, { type: result.blob.type });
      await navigator.share({
        files: [file],
        title: "Vantage recap",
        text: "My Vantage recap",
      });
      setSaved(true);
    } catch {
      /* user cancelled the share sheet */
    }
  }, [result]);

  const download = useCallback(() => {
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.filename;
    a.click();
    setSaved(true);
  }, [result]);

  const fullscreen = useCallback(() => {
    const v = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;
    if (!v) return;
    if (v.requestFullscreen) void v.requestFullscreen().catch(() => undefined);
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  }, []);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/96 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          recap ready{musicOn ? " · with sound" : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to reel"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-secondary"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-3">
        <video
          ref={videoRef}
          src={result.url}
          controls
          autoPlay
          loop
          playsInline
          className="max-h-full max-w-full rounded-md"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border bg-card px-5 py-4">
        {shareable ? (
          <button
            type="button"
            onClick={saveToGallery}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {saved ? <Check className="size-4" /> : <Share2 className="size-4" />}
            {saved ? "Saved" : "Save to gallery"}
          </button>
        ) : (
          <button
            type="button"
            onClick={download}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {saved ? <Check className="size-4" /> : <Download className="size-4" />}
            {saved ? "Downloaded" : "Download"}
          </button>
        )}
        {shareable && (
          <button
            type="button"
            onClick={download}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-secondary"
          >
            <Download className="size-4" />
            Download
          </button>
        )}
        <button
          type="button"
          onClick={fullscreen}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-secondary"
        >
          <Maximize className="size-4" />
          Full screen
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------- on-device recap video render -- */

const VID_W = 1080;
const VID_H = 1920;
const FPS = 30;
const FRAME_MS = 1000 / FPS;
const MAX_EXPORT_SLIDES = 24; // keep total reel within Instagram's ~90s; sampled evenly

interface RenderOpts {
  music: boolean;
  seed: number;
  onProgress: (p: number) => void;
}

/** Render the recap to a vertical video Blob mirroring the on-screen preview. */
async function renderRecapVideo(
  code: string,
  spaceName: string,
  media: MediaMeta[],
  opts: RenderOpts,
): Promise<{ blob: Blob; filename: string } | null> {
  if (media.length === 0) return null;

  const mime = pickRecorderMime();
  if (!mime) return null;

  const canvas = document.createElement("canvas");
  canvas.width = VID_W;
  canvas.height = VID_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // make sure the brand fonts are ready before we draw text to canvas
  try {
    await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
  } catch {
    /* ignore */
  }

  // Build the SAME timeline as the preview, then cap slide count for length.
  let segments = buildSegments(media);
  const slideSegs = segments.filter((s) => s.kind === "slide");
  if (slideSegs.length > MAX_EXPORT_SLIDES) {
    const keep = new Set(sampleEvenly(slideSegs, MAX_EXPORT_SLIDES).map((s) => s.id));
    segments = segments.filter((s) => s.kind !== "slide" || keep.has(s.id));
  }

  // Preload every image up front so recording never stalls on a fetch.
  const imgCache = new Map<string, HTMLImageElement>();
  const ids = new Set<string>();
  for (const s of segments) {
    if (s.kind === "slide") ids.add(s.frame.id);
    else if (s.kind === "moment") s.frames.slice(0, 9).forEach((f) => ids.add(f.id));
  }
  let loaded = 0;
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        imgCache.set(id, await loadImage(api.mediaUrl(code, id)));
      } catch {
        /* skip a frame that fails to load */
      }
      loaded += 1;
      opts.onProgress((loaded / Math.max(1, ids.size)) * 0.25);
    }),
  );

  // Wire up the recording stream (+ optional synthesized soundtrack).
  const stream = canvas.captureStream(FPS);
  let audio: { ctx: AudioContext; beat: { stop: () => void } } | null = null;
  if (opts.music) {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      const actx = new Ctor();
      await actx.resume();
      const dest = actx.createMediaStreamDestination();
      const beat = createBeats(actx, dest, { seed: opts.seed, gain: 0.85 });
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      audio = { ctx: actx, beat };
    } catch {
      audio = null;
    }
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (recorder.onstop = () => res()));
  recorder.start();

  const total = segments.length;
  const filterOk = ctxFilterSupported();

  // ---- draw the timeline in real time -------------------------------------
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (s.kind === "title") {
      await playCard(
        ctx,
        { eyebrow: "Recap", title: spaceName, sub: `${media.length} photos · every angle, one instant` },
        TIMING.title,
      );
    } else if (s.kind === "moment") {
      await playMoment(ctx, s.frames, imgCache, i, total, filterOk);
    } else {
      await playSlide(ctx, s.frame, imgCache, spaceName, i, total, filterOk);
    }
    opts.onProgress(0.25 + ((i + 1) / total) * 0.7);
  }
  await playCard(ctx, { eyebrow: "", title: "Vantage", sub: "every angle, one instant" }, TIMING.outro);

  recorder.stop();
  await done;
  if (audio) {
    try {
      audio.beat.stop();
      const a = audio;
      window.setTimeout(() => a.ctx.close().catch(() => undefined), 400);
    } catch {
      /* ignore */
    }
  }
  opts.onProgress(1);

  const blob = new Blob(chunks, { type: mime });
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  return { blob, filename: `vantage-recap.${ext}` };
}

/* ------------------------------------------------------ canvas draw helpers - */

function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

let _filterOk: boolean | null = null;
function ctxFilterSupported(): boolean {
  if (_filterOk !== null) return _filterOk;
  try {
    const c = document.createElement("canvas");
    const cx = c.getContext("2d");
    if (!cx) return (_filterOk = false);
    cx.filter = "blur(2px)";
    _filterOk = cx.filter === "blur(2px)";
  } catch {
    _filterOk = false;
  }
  return _filterOk;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Pre-render a slide's blurred, darkened cover backdrop once (cheap per-frame). */
function makeBackdrop(img: HTMLImageElement, filterOk: boolean): HTMLCanvasElement {
  const bg = document.createElement("canvas");
  bg.width = VID_W;
  bg.height = VID_H;
  const c = bg.getContext("2d")!;
  c.fillStyle = "#070707";
  c.fillRect(0, 0, VID_W, VID_H);
  const scale = Math.max(VID_W / img.width, VID_H / img.height) * 1.12;
  const w = img.width * scale;
  const h = img.height * scale;
  if (filterOk) c.filter = "blur(36px) brightness(0.5)";
  c.drawImage(img, (VID_W - w) / 2, (VID_H - h) / 2, w, h);
  c.filter = "none";
  c.fillStyle = "rgba(7,7,7,0.42)";
  c.fillRect(0, 0, VID_W, VID_H);
  return bg;
}

async function playSlide(
  ctx: CanvasRenderingContext2D,
  frame: MediaMeta,
  cache: Map<string, HTMLImageElement>,
  spaceName: string,
  index: number,
  total: number,
  filterOk: boolean,
): Promise<void> {
  const img = cache.get(frame.id);
  const durMs = TIMING.slide;
  const frames = Math.round(durMs / FRAME_MS);
  const fade = 9;
  const kb = kenBurns(index);
  const backdrop = img ? makeBackdrop(img, filterOk) : null;

  for (let f = 0; f < frames; f++) {
    const t = f / frames;
    const alpha = f < fade ? f / fade : 1;
    ctx.globalAlpha = alpha;
    if (backdrop) ctx.drawImage(backdrop, 0, 0);
    else {
      ctx.fillStyle = "#070707";
      ctx.fillRect(0, 0, VID_W, VID_H);
    }
    if (img) {
      const base = Math.min(VID_W / img.width, VID_H / img.height);
      const s = base * lerp(kb.from.scale, kb.to.scale, t);
      const w = img.width * s;
      const h = img.height * s;
      const x = (VID_W - w) / 2 + lerp(kb.from.x, kb.to.x, t) * VID_W;
      const y = (VID_H - h) / 2 + lerp(kb.from.y, kb.to.y, t) * VID_H;
      ctx.drawImage(img, x, y, w, h);
    }
    ctx.globalAlpha = 1;
    drawProgress(ctx, index, total, false);
    drawBottomLabel(ctx, `RECAP · ${spaceName}`, frame.displayName);
    await wait(FRAME_MS);
  }
}

async function playMoment(
  ctx: CanvasRenderingContext2D,
  frames: MediaMeta[],
  cache: Map<string, HTMLImageElement>,
  index: number,
  total: number,
  filterOk: boolean,
): Promise<void> {
  const durMs = TIMING.moment;
  const nFrames = Math.round(durMs / FRAME_MS);
  const fade = 10;
  const shown = frames.slice(0, 9);
  const cols = momentCols(shown.length);
  const rows = Math.ceil(shown.length / cols);
  const pad = 70;
  const gap = 16;
  const labelRoom = 220;
  const gridW = VID_W - pad * 2;
  const gridH = VID_H - pad * 2 - labelRoom;
  const cellW = (gridW - gap * (cols - 1)) / cols;
  const cellH = (gridH - gap * (rows - 1)) / rows;
  const cell = Math.min(cellW, cellH);
  const usedW = cell * cols + gap * (cols - 1);
  const usedH = cell * rows + gap * (rows - 1);
  const startX = (VID_W - usedW) / 2;
  const startY = pad + (gridH - usedH) / 2;

  // a subtle blurred backdrop from the first angle for cohesion
  const firstImg = cache.get(shown[0]?.id ?? "");
  const backdrop = firstImg ? makeBackdrop(firstImg, filterOk) : null;

  for (let f = 0; f < nFrames; f++) {
    const alpha = f < fade ? f / fade : 1;
    ctx.globalAlpha = alpha;
    if (backdrop) ctx.drawImage(backdrop, 0, 0);
    else {
      ctx.fillStyle = "#070707";
      ctx.fillRect(0, 0, VID_W, VID_H);
    }
    ctx.fillStyle = "rgba(7,7,7,0.4)";
    ctx.fillRect(0, 0, VID_W, VID_H);
    for (let k = 0; k < shown.length; k++) {
      const r = Math.floor(k / cols);
      const cIdx = k % cols;
      const x = startX + cIdx * (cell + gap);
      const y = startY + r * (cell + gap);
      const im = cache.get(shown[k].id);
      drawCoverInto(ctx, im, x, y, cell, cell);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cell, cell);
    }
    ctx.globalAlpha = 1;
    drawProgress(ctx, index, total, true);
    drawMomentLabel(ctx, shown.length);
    await wait(FRAME_MS);
  }
}

/** Draw an image cropped to cover a rect (object-cover). */
function drawCoverInto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!img) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x, y, w, h);
    return;
  }
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawProgress(
  ctx: CanvasRenderingContext2D,
  idx: number,
  total: number,
  curIsMoment: boolean,
): void {
  const pad = 28;
  const gap = 8;
  const top = 40;
  const h = 7;
  const avail = VID_W - pad * 2 - gap * (total - 1);
  const tw = avail / total;
  for (let i = 0; i < total; i++) {
    ctx.fillStyle =
      i < idx
        ? "#fafafa"
        : i === idx
          ? curIsMoment
            ? "#e5564a"
            : "#fafafa"
          : "rgba(255,255,255,0.28)";
    roundRect(ctx, pad + i * (tw + gap), top, tw, h, 3.5);
    ctx.fill();
  }
}

function drawBottomLabel(
  ctx: CanvasRenderingContext2D,
  eyebrow: string,
  name: string,
): void {
  const grad = ctx.createLinearGradient(0, VID_H - 460, 0, VID_H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, VID_H - 460, VID_W, 460);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#dcdcdc";
  ctx.font = "600 30px 'Geist Mono Variable', ui-monospace, monospace";
  ctx.fillText(spaced(eyebrow), 56, VID_H - 150);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 64px 'Geist Variable', system-ui, sans-serif";
  ctx.fillText(truncate(ctx, name, VID_W - 112), 56, VID_H - 84);
}

function drawMomentLabel(ctx: CanvasRenderingContext2D, n: number): void {
  const grad = ctx.createLinearGradient(0, VID_H - 320, 0, VID_H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, VID_H - 320, VID_W, 320);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e5564a";
  ctx.font = "600 34px 'Geist Mono Variable', ui-monospace, monospace";
  ctx.fillText(spaced(`THE MOMENT · ${n} ANGLES · ONE INSTANT`), VID_W / 2, VID_H - 120);
}

function spaced(s: string): string {
  return s.toUpperCase().split("").join(" ");
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: string,
  family: string,
  start: number,
): number {
  let px = start;
  ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && px > 36) {
    px -= 4;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
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
    ctx.font = "500 34px 'Geist Mono Variable', ui-monospace, monospace";
    ctx.fillText(spaced(opts.eyebrow), cx, cy - 150);
  }
  const tpx = fitFont(ctx, opts.title, VID_W * 0.84, "700", "'Geist Variable', system-ui, sans-serif", 132);
  ctx.fillStyle = "#fafafa";
  ctx.font = `700 ${tpx}px 'Geist Variable', system-ui, sans-serif`;
  ctx.fillText(opts.title, cx, cy + 6);
  ctx.fillStyle = "#8a8a8a";
  ctx.font = "400 30px 'Geist Mono Variable', ui-monospace, monospace";
  ctx.fillText(spaced(opts.sub), cx, cy + 130);
  ctx.restore();
}

/** Play a card with a fade in/out for `durMs`. */
async function playCard(
  ctx: CanvasRenderingContext2D,
  opts: { eyebrow: string; title: string; sub: string },
  durMs: number,
): Promise<void> {
  const FADE = 360;
  for (let t = 0; t <= durMs; t += FRAME_MS) {
    const a = t < FADE ? t / FADE : t > durMs - FADE ? (durMs - t) / FADE : 1;
    drawCard(ctx, { ...opts, alpha: a });
    await wait(FRAME_MS);
  }
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
