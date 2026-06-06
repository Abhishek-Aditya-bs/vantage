/**
 * Recap reel — a vertical, story-format playback of a space.
 *   • Title card → chronological Moments (multi-angle cards) + Ken-Burns photos → outro.
 *   • Tap right = forward, left = back, centre = pause/resume (Instagram-style).
 *   • Optional synthesized soundtrack with a 100+ groove picker (MusicPicker).
 *
 * The render/export is NOT owned here — it's driven by <Space> via onExport, so a
 * render keeps going and still shows its result even if the reel is closed by
 * tapping past the last frame. The reel just reflects the export phase/progress.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, Pause, Play, Volume2, VolumeX, Share2, Aperture, ListMusic } from "lucide-react";
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
import { createBeats, type BeatHandle, type BeatStyle, type BeatVariation } from "@/lib/beats";
import type { ExportPhase } from "@/lib/recapExport";
import { AsciiProgress } from "@/components/brand/AsciiProgress";
import { Mascot } from "@/components/brand/Mascot";
import { MusicPicker } from "@/components/space/MusicPicker";

export interface ExportRequest {
  music: boolean;
  style?: BeatStyle;
  variation?: number;
  seed: number;
}

interface RecapReelProps {
  code: string;
  spaceName: string;
  media: MediaMeta[];
  onClose: () => void;
  onExport: (req: ExportRequest) => void;
  exportPhase: ExportPhase;
  exportProgress: number;
}

interface NowPlaying {
  id: string;
  style: BeatStyle;
  variation: number;
  name: string;
}

export function RecapReel({
  code,
  spaceName,
  media,
  onClose,
  onExport,
  exportPhase,
  exportProgress,
}: RecapReelProps) {
  const segments = useMemo<Segment[]>(() => buildSegments(media), [media]);

  const [seg, setSeg] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedBeat, setSelectedBeat] = useState<BeatVariation | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);

  const liveMusicRef = useRef<{
    ctx: AudioContext;
    beat: BeatHandle;
    audioEl?: HTMLAudioElement;
  } | null>(null);
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
    setNowPlaying(null);
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

  /** Start (or restart) live playback of a specific groove, or random when null. */
  const startLive = useCallback(
    async (beat: BeatVariation | null) => {
      stopLiveMusic();
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctor();
        await ctx.resume();
        let handle: BeatHandle;
        let audioEl: HTMLAudioElement | undefined;
        // Route through an <audio> media element so it stays audible on iOS even
        // with the ring/silent switch ON (WebAudio → speakers is muted by it).
        if (typeof ctx.createMediaStreamDestination === "function") {
          const dest = ctx.createMediaStreamDestination();
          handle = createBeats(ctx, dest, {
            style: beat?.style,
            variation: beat?.variation,
            seed: musicSeed,
            gain: 0.85,
          });
          audioEl = new Audio();
          audioEl.srcObject = dest.stream;
          audioEl.setAttribute("playsinline", "");
          audioEl.autoplay = true;
          await audioEl.play().catch(() => undefined);
        } else {
          handle = createBeats(ctx, ctx.destination, {
            style: beat?.style,
            variation: beat?.variation,
            seed: musicSeed,
            gain: 0.85,
          });
        }
        liveMusicRef.current = { ctx, beat: handle, audioEl };
        setNowPlaying({
          id: `${handle.style}-${handle.variation}`,
          style: handle.style,
          variation: handle.variation,
          name: handle.name,
        });
        setMusicOn(true);
      } catch {
        /* audio unavailable */
      }
    },
    [musicSeed, stopLiveMusic],
  );

  const toggleMusic = useCallback(() => {
    if (musicOn) {
      setMusicOn(false);
      stopLiveMusic();
    } else {
      void startLive(selectedBeat);
    }
  }, [musicOn, selectedBeat, startLive, stopLiveMusic]);

  const onSelectBeat = useCallback(
    (beat: BeatVariation | null) => {
      setSelectedBeat(beat);
      void startLive(beat);
    },
    [startLive],
  );

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

  const triggerExport = useCallback(() => {
    if (media.length === 0 || exportPhase === "rendering") return;
    const beat = selectedBeat ?? (nowPlaying ? { style: nowPlaying.style, variation: nowPlaying.variation } : null);
    onExport({ music: musicOn, style: beat?.style, variation: beat?.variation, seed: musicSeed });
  }, [media.length, exportPhase, selectedBeat, nowPlaying, musicOn, musicSeed, onExport]);

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
        {segments.length > 0 && (
          <div className="absolute inset-0 z-20 flex">
            <button type="button" className="h-full w-[32%] cursor-default outline-none" onClick={goPrev} aria-label="Previous" />
            <button type="button" className="h-full w-[36%] cursor-default outline-none" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} />
            <button type="button" className="h-full w-[32%] cursor-default outline-none" onClick={goNext} aria-label="Next" />
          </div>
        )}
      </div>

      {/* controls */}
      <div className="z-30 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border hover:bg-secondary"
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button
            type="button"
            onClick={toggleMusic}
            aria-label={musicOn ? "Mute soundtrack" : "Play soundtrack"}
            aria-pressed={musicOn}
            className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border hover:bg-secondary ${
              musicOn ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {musicOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Choose a soundtrack"
            className="inline-flex h-10 min-w-0 items-center gap-2 rounded-md border border-border px-3 hover:bg-secondary"
          >
            <ListMusic className="size-4 shrink-0" />
            <span className="truncate font-mono text-[0.7rem] text-muted-foreground">
              {musicOn && nowPlaying ? nowPlaying.name : selectedBeat ? selectedBeat.name : "Music"}
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {exportPhase === "rendering" ? (
            <AsciiProgress value={exportProgress} width={10} label="Rendering" />
          ) : (
            <span title="Render a vertical video and save it to your gallery (or download on desktop)">
              <button
                type="button"
                onClick={triggerExport}
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

      <MusicPicker
        open={pickerOpen}
        current={selectedBeat}
        playingId={musicOn && nowPlaying ? nowPlaying.id : null}
        onSelect={onSelectBeat}
        onClose={() => setPickerOpen(false)}
      />
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
          <div key={m.id} className="aspect-square overflow-hidden rounded-md border border-white/15">
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
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-[0.45]"
      />
      <motion.img
        src={src}
        alt={`Recap frame by ${frame.displayName}`}
        initial={{ scale: kb.from.scale, x: `${kb.from.x * 100}%`, y: `${kb.from.y * 100}%` }}
        animate={{ scale: kb.to.scale, x: `${kb.to.x * 100}%`, y: `${kb.to.y * 100}%` }}
        transition={{ duration: TIMING.slide / 1000, ease: "linear" }}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </motion.div>
  );
}
