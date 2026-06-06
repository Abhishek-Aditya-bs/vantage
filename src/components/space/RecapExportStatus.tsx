/**
 * Global recap-export status — lives in <Space>, NOT in the reel, so a render
 * keeps going (and still surfaces its result) even after the reel is closed by
 * tapping past the last frame. Shows a floating progress pill while rendering and
 * a full-screen result view (save to gallery / download / watch full-screen) when
 * ready.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, Share2, Download, Maximize, Check } from "lucide-react";
import { IrisShutter } from "@/components/brand/IrisShutter";
import type { ExportPhase, ExportResult } from "@/lib/recapExport";

interface Props {
  phase: ExportPhase;
  progress: number;
  result: ExportResult | null;
  /** true while the reel is open (so we hide the redundant pill behind it) */
  reelOpen: boolean;
  onDismiss: () => void;
}

export function RecapExportStatus({ phase, progress, result, reelOpen, onDismiss }: Props) {
  return createPortal(
    <>
      <AnimatePresence>
        {phase === "rendering" && !reelOpen && (
          <motion.div
            key="pill"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4"
          >
            <div className="flex items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-2 shadow-lg backdrop-blur">
              <IrisShutter size={22} active progress={Math.max(0.05, progress)} ariaLabel="Rendering recap" />
              <span className="font-mono text-xs text-foreground">
                rendering recap… {Math.round(progress * 100)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "ready" && result && <ResultView result={result} onClose={onDismiss} />}
    </>,
    document.body,
  );
}

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

function ResultView({ result, onClose }: { result: ExportResult; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [saved, setSaved] = useState(false);
  const shareable = useMemo(() => canShareFiles(result.blob, result.filename), [result]);

  const saveToGallery = useCallback(async () => {
    try {
      const file = new File([result.blob], result.filename, { type: result.blob.type });
      await navigator.share({ files: [file], title: "Vantage recap", text: "My Vantage recap" });
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
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          recap ready
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
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

      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border bg-card px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
