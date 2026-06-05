/**
 * Capture sheet — a bottom sheet that opens the rear camera (getUserMedia),
 * shows a live preview, and captures a frame on tap. Falls back to a native
 * file input (capture="environment") when the camera API is unavailable or
 * denied. Compresses to <= MAX_MEDIA_BYTES before handing the blob to onCapture.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ImageUp, X, RefreshCw } from "lucide-react";
import {
  openCamera,
  stopStream,
  grabFrame,
  compressFile,
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

export function CaptureSheet({ open, onClose, onCapture }: CaptureSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

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
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        if (!cancelled) setCamError("Camera unavailable — use upload instead.");
      }
    })();

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [open, facing]);

  async function capture() {
    const v = videoRef.current;
    if (!v || busy) return;
    setBusy(true);
    try {
      const frame = await grabFrame(v);
      await onCapture(frame);
      onClose();
    } catch {
      setCamError("Couldn't capture that frame.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    try {
      const frame = await compressFile(file);
      await onCapture(frame);
      onClose();
    } catch {
      setCamError("Couldn't process that image.");
    } finally {
      setBusy(false);
    }
  }

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
                className="h-full w-full object-cover"
                style={{ display: camError ? "none" : "block" }}
              />
              {!ready && !camError && (
                <div className="absolute inset-0 grid place-items-center">
                  <IrisShutter size={72} ariaLabel="Starting camera" />
                </div>
              )}
              {camError && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center">
                  <p className="text-sm text-muted-foreground">{camError}</p>
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
                disabled={busy}
              >
                <ImageUp className="size-5" />
              </Button>

              <button
                type="button"
                onClick={capture}
                disabled={busy || !ready || !!camError}
                aria-label="Take photo"
                className="group relative grid size-16 place-items-center rounded-full border-4 border-foreground/80 bg-moment outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
              >
                {busy ? (
                  <IrisShutter size={28} active progress={0.5} />
                ) : (
                  <Camera className="size-6 text-moment-foreground" />
                )}
              </button>

              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setFacing((f) => (f === "environment" ? "user" : "environment"))
                }
                aria-label="Switch camera"
                disabled={busy || !!camError}
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
