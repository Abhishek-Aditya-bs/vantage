/**
 * Moment countdown — fullscreen iris-shutter synchronized to the server's
 * captureAtServer time (converted to local via the clock offset). Every client
 * shows the same countdown; at T0 it auto-captures a frame from a hidden camera
 * stream and hands it to onCapture for upload (kind 'moment').
 *
 * Uses its own short-lived getUserMedia stream so it works even if the capture
 * sheet is closed. Falls back gracefully if the camera is unavailable.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { openCamera, stopStream, grabFrame, type CapturedFrame } from "@/lib/capture";
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
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const firedRef = useRef(false);

  // warm up a hidden camera stream while the countdown runs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await openCamera("environment");
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const v = document.createElement("video");
        v.playsInline = true;
        v.muted = true;
        v.srcObject = stream;
        await v.play().catch(() => undefined);
        videoRef.current = v;
      } catch {
        /* no camera — we'll just skip the frame at T0 */
      }
    })();
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      videoRef.current = null;
    };
  }, []);

  // tick toward T0; fire the capture exactly once at the synchronized instant
  useEffect(() => {
    let raf = 0;
    const tick = async () => {
      const localTarget = serverTimeToLocal(captureAtServer);
      const left = localTarget - Date.now();
      setRemainingMs(Math.max(0, left));

      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        setCaptured(true);
        const v = videoRef.current;
        if (v) {
          try {
            const frame = await grabFrame(v);
            await onCapture(frame);
          } catch {
            /* swallow — server has a collect window for stragglers */
          }
        }
        // brief "captured" hold, then close
        window.setTimeout(onDone, 900);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [captureAtServer, serverTimeToLocal, onCapture, onDone]);

  const total = MOMENT_COUNTDOWN_MS;
  const progress = 1 - Math.min(1, remainingMs / total); // 0 -> 1 as we approach
  const secs = Math.ceil(remainingMs / 1000);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] grid place-items-center bg-background/95 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      role="dialog"
      aria-modal="true"
      aria-label="Synchronized capture countdown"
    >
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
        <p className="mt-10 font-display text-2xl font-bold tracking-tight">
          {captured ? "Captured." : "Hold still — everyone shoots together"}
        </p>
        {triggeredBy && !captured && (
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            triggered by {triggeredBy}
          </p>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
