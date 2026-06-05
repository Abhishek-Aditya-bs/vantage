/**
 * Single-image lightbox for tapping a wall tile. Escape / backdrop to close.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { X } from "lucide-react";
import type { MediaMeta } from "@shared/protocol";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";

interface ImageLightboxProps {
  code: string;
  media: MediaMeta;
  onClose: () => void;
}

export function ImageLightbox({ code, media, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[65] flex flex-col bg-background/95 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo by ${media.displayName}`}
      onClick={onClose}
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-secondary"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <motion.img
          src={api.mediaUrl(code, media.id)}
          alt={`by ${media.displayName}`}
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="max-h-full max-w-full rounded-lg border border-border object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <p className="pt-3 text-center font-mono text-sm">
        <span className="text-foreground">{media.displayName}</span>
        <span className="text-muted-foreground">
          {" "}
          · {relativeTime(media.createdAt)}
        </span>
      </p>
    </motion.div>,
    document.body,
  );
}
