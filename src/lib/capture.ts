/**
 * Camera + image-compression utilities.
 *
 * Flow: getUserMedia() -> draw a <video> frame onto a <canvas> -> toBlob() ->
 * compress under MAX_MEDIA_BYTES by stepping quality then dimensions down.
 * A plain <input capture> fallback is provided for browsers/contexts where
 * getUserMedia is blocked.
 */
import { MAX_MEDIA_BYTES } from "@shared/constants";

export interface CapturedFrame {
  blob: Blob;
  width: number;
  height: number;
}

/** Open the rear ("environment") camera by default. Caller must stop tracks. */
export async function openCamera(
  facing: "environment" | "user" = "environment",
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera API unavailable");
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
  } catch {
    // Relax constraints if the ideal facing mode is unavailable.
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Grab the current frame of a playing <video> as a compressed blob. */
export async function grabFrame(
  video: HTMLVideoElement,
  maxBytes = MAX_MEDIA_BYTES,
): Promise<CapturedFrame> {
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(video, 0, 0, w, h);
  const blob = await canvasToBlob(canvas, "image/webp", 0.85);
  return compressImageBlob(blob, maxBytes);
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
 * Re-encode an image blob until it fits within `maxBytes`.
 * Strategy: try WebP (then JPEG) at descending quality; if still too big,
 * downscale the longest edge by 15% and repeat. Bounded iteration count.
 */
export async function compressImageBlob(
  input: Blob,
  maxBytes = MAX_MEDIA_BYTES,
): Promise<CapturedFrame> {
  const bitmap = await blobToBitmap(input);
  const { w: srcW, h: srcH } = bitmapSize(bitmap);
  let width = srcW || 1280;
  let height = srcH || 720;

  const types = supportsWebpEncoding() ? ["image/webp", "image/jpeg"] : ["image/jpeg"];
  let best: CapturedFrame = {
    blob: input,
    width,
    height,
  };

  for (let pass = 0; pass < 8; pass++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);

    for (const type of types) {
      for (const quality of [0.82, 0.7, 0.6, 0.5]) {
        let blob: Blob;
        try {
          blob = await canvasToBlob(canvas, type, quality);
        } catch {
          continue;
        }
        if (blob.size <= maxBytes) {
          closeBitmap(bitmap);
          return { blob, width: canvas.width, height: canvas.height };
        }
        // Track the smallest encoding seen, in case we never get under budget.
        if (blob.size < best.blob.size) {
          best = { blob, width: canvas.width, height: canvas.height };
        }
      }
    }
    // Still too large — shrink and try again.
    width *= 0.85;
    height *= 0.85;
  }

  closeBitmap(bitmap);
  return best;
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
