/**
 * On-device recap video renderer — produces a vertical 1080×1920 MP4 (H.264/AAC
 * where supported, else WebM) that mirrors the on-screen reel: blurred backdrop
 * + contained photo + captions + segment progress + moment collages, with an
 * optional synthesized soundtrack baked into the audio track.
 *
 * This is a plain async function with no React ties, so it runs to completion
 * even if the reel is closed mid-render (the store that calls it lives above the
 * reel). It records in real time (canvas.captureStream + MediaRecorder).
 */
import type { MediaMeta } from "@shared/protocol";
import { api } from "@/lib/api";
import { buildSegments, momentCols, kenBurns, TIMING } from "@/lib/recap";
import { createBeats, type BeatStyle } from "@/lib/beats";

const VID_W = 1080;
const VID_H = 1920;
const FPS = 30;
const FRAME_MS = 1000 / FPS;
const MAX_EXPORT_SLIDES = 24; // keep total reel within Instagram's ~90s; sampled evenly

export interface RenderOpts {
  music: boolean;
  style?: BeatStyle;
  variation?: number;
  seed: number;
  onProgress: (p: number) => void;
}

export interface RenderedRecap {
  blob: Blob;
  filename: string;
}

/** Export lifecycle, owned by <Space> so it survives the reel being closed. */
export type ExportPhase = "idle" | "rendering" | "ready" | "error";

export interface ExportResult {
  url: string;
  blob: Blob;
  filename: string;
}

/** Render the recap to a vertical video Blob mirroring the on-screen preview. */
export async function renderRecapVideo(
  code: string,
  spaceName: string,
  media: MediaMeta[],
  opts: RenderOpts,
): Promise<RenderedRecap | null> {
  if (media.length === 0) return null;

  const mime = pickRecorderMime();
  if (!mime) return null;

  const canvas = document.createElement("canvas");
  canvas.width = VID_W;
  canvas.height = VID_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

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

  // Preload every image so recording never stalls on a fetch.
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

  const stream = canvas.captureStream(FPS);
  let audio: { ctx: AudioContext; beat: { stop: () => void } } | null = null;
  if (opts.music) {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const actx = new Ctor();
      await actx.resume();
      const dest = actx.createMediaStreamDestination();
      const beat = createBeats(actx, dest, {
        style: opts.style,
        variation: opts.variation,
        seed: opts.seed,
        gain: 0.85,
      });
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
  const frames = Math.round(TIMING.slide / FRAME_MS);
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
  const nFrames = Math.round(TIMING.moment / FRAME_MS);
  const fade = 10;
  const shown = frames.slice(0, 9);
  const cols = momentCols(shown.length);
  const rows = Math.ceil(shown.length / cols);
  const pad = 70;
  const gap = 16;
  const labelRoom = 220;
  const gridW = VID_W - pad * 2;
  const gridH = VID_H - pad * 2 - labelRoom;
  const cell = Math.min((gridW - gap * (cols - 1)) / cols, (gridH - gap * (rows - 1)) / rows);
  const usedW = cell * cols + gap * (cols - 1);
  const usedH = cell * rows + gap * (rows - 1);
  const startX = (VID_W - usedW) / 2;
  const startY = pad + (gridH - usedH) / 2;

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
      drawCoverInto(ctx, cache.get(shown[k].id), x, y, cell, cell);
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
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function drawProgress(ctx: CanvasRenderingContext2D, idx: number, total: number, curIsMoment: boolean): void {
  const pad = 28;
  const gap = 8;
  const top = 40;
  const h = 7;
  const avail = VID_W - pad * 2 - gap * (total - 1);
  const tw = avail / total;
  for (let i = 0; i < total; i++) {
    ctx.fillStyle =
      i < idx ? "#fafafa" : i === idx ? (curIsMoment ? "#e5564a" : "#fafafa") : "rgba(255,255,255,0.28)";
    roundRect(ctx, pad + i * (tw + gap), top, tw, h, 3.5);
    ctx.fill();
  }
}

function drawBottomLabel(ctx: CanvasRenderingContext2D, eyebrow: string, name: string): void {
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
  return s.toUpperCase().split("").join(" ");
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
