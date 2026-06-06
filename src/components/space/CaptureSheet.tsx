/**
 * Capture sheet — a bottom sheet that opens the rear camera (getUserMedia),
 * shows a live preview, and captures a frame on tap.
 *
 * The shutter is instant: tapping snapshots the frame synchronously, closes the
 * sheet immediately, then compresses + uploads in the background (the wall shows
 * an optimistic tile meanwhile). It never blocks on the network.
 *
 * Permissions: if the camera is blocked or dismissed, the sheet shows a clear
 * "Allow camera" affordance that re-prompts, and always offers a native
 * file-input fallback (capture="environment").
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ImageUp, X, RefreshCw, ShieldAlert } from "lucide-react";
import {
  openCamera,
  stopStream,
  snapshotToCanvas,
  compressCanvas,
  compressFile,
  cameraErrorKind,
  type CameraErrorKind,
  type CapturedFrame,
} from "@/lib/capture";
import { Button } from "@/components/ui/button";
import { IrisShutter } from "@/components/brand/IrisShutter";

interface CaptureSheetProps {
  open: boolean;
  onClose: () => void;
  /** receives the compressed frame; should perform the upload */
  onCapture: (frame: CapturedFrame) => void | Promise<void>;
}

const ERROR_COPY: Record<CameraErrorKind, { title: string; body: string; retry: boolean }> = {
  denied: {
    title: "Camera access is blocked",
    body: "Tap Allow camera to grant access. If you blocked it before, enable the camera for this site in your browser settings — or just upload a photo.",
    retry: true,
  },
  notfound: {
    title: "No camera found",
    body: "We couldn't find a camera on this device. Upload a photo instead.",
    retry: true,
  },
  inuse: {
    title: "Camera is busy",
    body: "Your camera is in use by another app. Close it and try again, or upload a photo.",
    retry: true,
  },
  insecure: {
    title: "Secure connection needed",
    body: "The camera only works over https. Upload a photo instead.",
    retry: false,
  },
  unsupported: {
    title: "Camera unavailable",
    body: "This browser can't open the camera here. Upload a photo instead.",
    retry: false,
  },
  other: {
    title: "Camera unavailable",
    body: "Something went wrong starting the camera. Try again or upload a photo.",
    retry: true,
  },
};

export function CaptureSheet({ open, onClose, onCapture }: CaptureSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<CameraErrorKind | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  // Re-running this on demand re-prompts for permission after a denial/dismissal.
  const [retryNonce, setRetryNonce] = useState(0);
  // Mirror the selfie/webcam feed (like the iPhone front camera & a real mirror).
  // Only the rear/"environment" camera is shown un-mirrored.
  const [mirrored, setMirrored] = useState(false);

  // start / stop the camera with the sheet's open state
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    setCamError(null);

    (async () => {
      try {
        const stream = await openCamera(facing);
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        // The browser may fall back to a different camera than requested; trust
        // the actual track. Rear cam reports facingMode "environment" → no mirror;
        // selfie ("user") and desktop webcams (undefined) → mirror.
        const settings = stream.getVideoTracks()[0]?.getSettings();
        setMirrored(settings?.facingMode !== "environment");
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) setCamError(cameraErrorKind(err));
      }
    })();

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [open, facing, retryNonce]);

  /** The shutter: snapshot now, close now, compress + upload in the background. */
  function capture() {
    const v = videoRef.current;
    if (!v || !ready || camError) return;
    let canvas: HTMLCanvasElement;
    try {
      canvas = snapshotToCanvas(v, mirrored);
    } catch {
      setCamError("other");
      return;
    }
    onClose(); // the shutter has fired — get out of the way immediately
    void (async () => {
      try {
        const frame = await compressCanvas(canvas);
        await onCapture(frame);
      } catch {
        /* the uploader surfaces a toast on failure */
      }
    })();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    onClose();
    void (async () => {
      try {
        const frame = await compressFile(file);
        await onCapture(frame);
      } catch {
        /* the uploader surfaces a toast on failure */
      }
    })();
  }

  function retry() {
    setCamError(null);
    setReady(false);
    setRetryNonce((n) => n + 1);
  }

  const errorCopy = camError ? ERROR_COPY[camError] : null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-background/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Take a photo"
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.6 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                capture
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close camera"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* live preview / fallback */}
            <div className="relative aspect-[3/4] w-full bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="h-full w-full object-cover"
                style={{
                  display: camError ? "none" : "block",
                  transform: mirrored ? "scaleX(-1)" : undefined,
                }}
              />
              {!ready && !camError && (
                <div className="absolute inset-0 grid place-items-center">
                  <IrisShutter size={72} ariaLabel="Starting camera" />
                </div>
              )}
              {errorCopy && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center">
                  <div className="flex max-w-xs flex-col items-center gap-3">
                    <ShieldAlert className="size-7 text-moment" />
                    <p className="font-display text-base font-semibold text-foreground">
                      {errorCopy.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{errorCopy.body}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {errorCopy.retry && (
                        <Button size="sm" onClick={retry}>
                          {camError === "denied" ? "Allow camera" : "Try again"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                      >
                        <ImageUp className="size-4" />
                        Upload a photo
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {/* framing corners */}
              {!camError && (
                <>
                  <Corner className="left-3 top-3" />
                  <Corner className="right-3 top-3 rotate-90" />
                  <Corner className="bottom-3 left-3 -rotate-90" />
                  <Corner className="bottom-3 right-3 rotate-180" />
                </>
              )}
            </div>

            {/* controls */}
            <div className="flex items-center justify-between gap-3 p-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileRef.current?.click()}
                aria-label="Upload a photo instead"
              >
                <ImageUp className="size-5" />
              </Button>

              <button
                type="button"
                onClick={capture}
                disabled={!ready || !!camError}
                aria-label="Take photo"
                className="group relative grid size-16 place-items-center rounded-full border-4 border-foreground/80 bg-moment outline-none transition-transform active:scale-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
              >
                <Camera className="size-6 text-moment-foreground" />
              </button>

              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setFacing((f) => (f === "environment" ? "user" : "environment"))
                }
                aria-label="Switch camera"
                disabled={!!camError}
              >
                <RefreshCw className="size-5" />
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFile}
              className="sr-only"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Corner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute size-5 border-l-2 border-t-2 border-primary/80 ${className ?? ""}`}
    />
  );
}
