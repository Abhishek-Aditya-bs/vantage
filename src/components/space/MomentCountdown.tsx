/**
 * Moment countdown — fullscreen iris-shutter synchronized to the server's
 * captureAtServer time (converted to local via the clock offset). Every client
 * shows the same countdown; at T0 it auto-captures a frame and hands it to
 * onCapture for upload (kind 'moment').
 *
 * The camera feed is shown LIVE behind the shutter (dimmed) so everyone can see
 * what they're framing before the instant fires. At T0 the frame is snapshotted
 * synchronously (instant), the overlay releases quickly, and the compress +
 * upload happen in the background. Falls back gracefully if the camera is
 * unavailable, with a re-allow path.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { CameraOff } from "lucide-react";
import {
  openCamera,
  stopStream,
  snapshotToCanvas,
  compressCanvas,
  type CapturedFrame,
} from "@/lib/capture";
import { IrisShutter } from "@/components/brand/IrisShutter";
import { MOMENT_COUNTDOWN_MS } from "@shared/constants";

interface MomentCountdownProps {
  momentId: string;
  /** server clock at which to capture */
  captureAtServer: number;
  triggeredBy?: string;
  serverTimeToLocal: (serverTs: number) => number;
  /** called once with the captured frame at T0 (may be skipped if no camera) */
  onCapture: (frame: CapturedFrame) => void | Promise<void>;
  /** called when the countdown + capture is finished (overlay can close) */
  onDone: () => void;
}

export function MomentCountdown({
  captureAtServer,
  triggeredBy,
  serverTimeToLocal,
  onCapture,
  onDone,
}: MomentCountdownProps) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, serverTimeToLocal(captureAtServer) - Date.now()),
  );
  const [captured, setCaptured] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [camFailed, setCamFailed] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const firedRef = useRef(false);

  // warm up a visible camera stream while the countdown runs
  useEffect(() => {
    let cancelled = false;
    setCamFailed(false);
    setCamReady(false);
    (async () => {
      try {
        const stream = await openCamera("environment");
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const settings = stream.getVideoTracks()[0]?.getSettings();
        setMirrored(settings?.facingMode !== "environment");
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setCamReady(true);
      } catch {
        // 'denied'/'notfound'/etc — let people retry; the moment still
        // completes from everyone else's angles.
        if (!cancelled) setCamFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [retryNonce]);

  // tick toward T0; fire the capture exactly once at the synchronized instant
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const localTarget = serverTimeToLocal(captureAtServer);
      const left = localTarget - Date.now();
      setRemainingMs(Math.max(0, left));

      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        // 1) snapshot pixels synchronously — THIS is the synchronized instant
        const v = videoRef.current;
        let canvas: HTMLCanvasElement | null = null;
        if (v && v.videoWidth > 0) {
          try {
            canvas = snapshotToCanvas(v, mirrored);
          } catch {
            canvas = null;
          }
        }
        setCaptured(true);
        // 2) release the overlay quickly — don't wait on compression/upload
        window.setTimeout(onDone, 700);
        // 3) compress + upload in the background (server has a collect window)
        if (canvas) {
          void (async () => {
            try {
              const frame = await compressCanvas(canvas);
              await onCapture(frame);
            } catch {
              /* swallow — the collect window tolerates stragglers */
            }
          })();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [captureAtServer, serverTimeToLocal, onCapture, onDone, mirrored]);

  const total = MOMENT_COUNTDOWN_MS;
  const progress = 1 - Math.min(1, remainingMs / total); // 0 -> 1 as we approach
  const secs = Math.ceil(remainingMs / 1000);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      role="dialog"
      aria-modal="true"
      aria-label="Synchronized capture countdown"
    >
      {/* live camera preview — what you're about to shoot */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
        style={{
          opacity: camReady && !captured ? 0.9 : 0,
          transform: mirrored ? "scaleX(-1)" : undefined,
        }}
      />
      {/* dim layer so the iris + copy stay legible over any scene */}
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[1px]" />

      <div className="relative grid h-full place-items-center p-6">
        <div className="flex flex-col items-center text-center">
          <p className="mb-8 font-mono text-xs uppercase tracking-[0.28em] text-moment">
            ● moment in progress
          </p>
          <IrisShutter
            size={260}
            active
            progress={captured ? 1 : progress}
            label={captured ? "✓" : secs > 0 ? String(secs) : "0"}
            ariaLabel="Capturing in sync"
          />
          <p className="mt-10 font-display text-2xl font-bold tracking-tight text-foreground">
            {captured ? "Captured." : "Frame your shot — everyone shoots together"}
          </p>
          {triggeredBy && !captured && (
            <p className="mt-2 font-mono text-sm text-muted-foreground">
              triggered by {triggeredBy}
            </p>
          )}
          {camFailed && !captured && (
            <button
              type="button"
              onClick={() => setRetryNonce((n) => n + 1)}
              className="mt-5 inline-flex items-center gap-2 rounded-md border border-border bg-card/80 px-3 py-2 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              <CameraOff className="size-4" />
              Camera off — tap to enable your angle
            </button>
          )}
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
