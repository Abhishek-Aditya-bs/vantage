/**
 * Camera + image-compression utilities.
 *
 * Flow: getUserMedia() -> snapshot a <video> frame onto a <canvas> (sync, the
 * "shutter" instant) -> encode under MAX_MEDIA_BYTES by stepping quality then
 * dimensions down. The snapshot is split from the encode so the UI can close the
 * camera the moment the shutter fires and compress/upload in the background.
 *
 * A plain <input capture> fallback is provided for browsers/contexts where
 * getUserMedia is blocked, plus permission helpers so the UI can prompt once,
 * skip the prompt when already granted, and offer a clear re-allow path.
 */
import { MAX_MEDIA_BYTES } from "@shared/constants";

export interface CapturedFrame {
  blob: Blob;
  width: number;
  height: number;
}

/** Why the camera couldn't open — drives the message + retry affordance shown. */
export type CameraErrorKind =
  | "denied" // user blocked / dismissed the permission prompt
  | "notfound" // no camera, or constraints can't be satisfied
  | "inuse" // hardware busy / not readable
  | "insecure" // not a secure context (http) — getUserMedia is unavailable
  | "unsupported" // browser has no getUserMedia at all
  | "other";

/** Classify a getUserMedia rejection so the UI can react appropriately. */
export function cameraErrorKind(err: unknown): CameraErrorKind {
  if (!navigator.mediaDevices?.getUserMedia) {
    return window.isSecureContext === false ? "insecure" : "unsupported";
  }
  const name = (err as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "notfound";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "inuse";
    default:
      return "other";
  }
}

/**
 * Best-effort read of the camera permission state via the Permissions API.
 * Returns "unknown" when the API (or the "camera" descriptor) is unavailable —
 * notably Safari, where callers must just attempt getUserMedia.
 */
export async function queryCameraPermission(): Promise<
  PermissionState | "unknown"
> {
  try {
    const perms = (navigator as Navigator & { permissions?: Permissions })
      .permissions;
    if (!perms?.query) return "unknown";
    // "camera" isn't in the TS PermissionName union in every lib version.
    const status = await perms.query({
      name: "camera" as PermissionName,
    });
    return status.state;
  } catch {
    return "unknown";
  }
}

/** Open the rear ("environment") camera by default. Caller must stop tracks. */
export async function openCamera(
  facing: "environment" | "user" = "environment",
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error("Camera API unavailable");
    err.name = window.isSecureContext === false ? "SecurityError" : "NotSupportedError";
    throw err;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  } catch (err) {
    // A hard denial must propagate so the UI can show the re-allow path.
    if (cameraErrorKind(err) === "denied") throw err;
    // Otherwise relax constraints (e.g. the ideal facing mode is unavailable).
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Snapshot the current frame of a playing <video> onto a detached canvas.
 * Synchronous and cheap — this is the "shutter" instant. `mirror` horizontally
 * flips it so a selfie/webcam photo matches the mirrored preview (WYSIWYG).
 */
export function snapshotToCanvas(
  video: HTMLVideoElement,
  mirror = false,
): HTMLCanvasElement {
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
}

/** Encode an already-drawn canvas under `maxBytes` (no extra decode). */
export function compressCanvas(
  canvas: HTMLCanvasElement,
  maxBytes = MAX_MEDIA_BYTES,
): Promise<CapturedFrame> {
  return encodeUnderBudget(canvas, canvas.width, canvas.height, maxBytes);
}

/**
 * Grab the current frame of a playing <video> as a compressed blob.
 * Convenience wrapper around snapshotToCanvas + compressCanvas.
 */
export async function grabFrame(
  video: HTMLVideoElement,
  opts: { maxBytes?: number; mirror?: boolean } = {},
): Promise<CapturedFrame> {
  const { maxBytes = MAX_MEDIA_BYTES, mirror = false } = opts;
  const canvas = snapshotToCanvas(video, mirror);
  return compressCanvas(canvas, maxBytes);
}

/** Promise wrapper around canvas.toBlob with a graceful encoder fallback. */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Encoding failed"));
      },
      type,
      quality,
    );
  });
}

async function blobToBitmap(
  blob: Blob,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through to <img> decode */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function bitmapSize(src: ImageBitmap | HTMLImageElement): {
  w: number;
  h: number;
} {
  if ("width" in src && "height" in src) {
    const w =
      (src as HTMLImageElement).naturalWidth ||
      (src as ImageBitmap).width ||
      0;
    const h =
      (src as HTMLImageElement).naturalHeight ||
      (src as ImageBitmap).height ||
      0;
    return { w, h };
  }
  return { w: 0, h: 0 };
}

/**
 * Re-encode a drawable source until it fits within `maxBytes`.
 * Strategy: try WebP (then JPEG) at descending quality; if still too big,
 * downscale the longest edge by 15% and repeat. Bounded iteration count.
 * `fallback` is returned (as the smallest seen) if nothing ever fits.
 */
async function encodeUnderBudget(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxBytes: number,
  fallback?: Blob,
): Promise<CapturedFrame> {
  let width = srcW || 1280;
  let height = srcH || 720;

  const types = supportsWebpEncoding()
    ? ["image/webp", "image/jpeg"]
    : ["image/jpeg"];
  let best: CapturedFrame | null = fallback
    ? { blob: fallback, width, height }
    : null;

  for (let pass = 0; pass < 8; pass++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    for (const type of types) {
      for (const quality of [0.82, 0.7, 0.6, 0.5]) {
        let blob: Blob;
        try {
          blob = await canvasToBlob(canvas, type, quality);
        } catch {
          continue;
        }
        if (blob.size <= maxBytes) {
          return { blob, width: canvas.width, height: canvas.height };
        }
        // Track the smallest encoding seen, in case we never get under budget.
        if (!best || blob.size < best.blob.size) {
          best = { blob, width: canvas.width, height: canvas.height };
        }
      }
    }
    // Still too large — shrink and try again.
    width *= 0.85;
    height *= 0.85;
  }

  if (best) return best;
  throw new Error("Could not encode image");
}

/**
 * Re-encode an image blob until it fits within `maxBytes`.
 */
export async function compressImageBlob(
  input: Blob,
  maxBytes = MAX_MEDIA_BYTES,
): Promise<CapturedFrame> {
  const bitmap = await blobToBitmap(input);
  const { w, h } = bitmapSize(bitmap);
  try {
    return await encodeUnderBudget(bitmap, w, h, maxBytes, input);
  } finally {
    closeBitmap(bitmap);
  }
}

function closeBitmap(b: ImageBitmap | HTMLImageElement): void {
  if (typeof ImageBitmap !== "undefined" && b instanceof ImageBitmap) {
    b.close();
  }
}

/** Feature-detect lossy WebP encoding once (some Safaris only decode WebP). */
let webpEncode: boolean | null = null;
function supportsWebpEncoding(): boolean {
  if (webpEncode !== null) return webpEncode;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    webpEncode = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpEncode = false;
  }
  return webpEncode;
}

/** Compress a user-selected File (the <input capture> fallback path). */
export async function compressFile(file: File): Promise<CapturedFrame> {
  return compressImageBlob(file);
}
