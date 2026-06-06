/**
 * Soundtrack picker — a bottom-sheet "album" of synthesized grooves (the closest
 * we can get to Instagram's music picker without licensing real tracks). Tapping
 * a track selects it AND previews it live; "Shuffle" lets the engine pick a fresh
 * groove for each reel. Everything is generated on the fly, so it's copyright-
 * clear; the tracks loop to fit the reel rather than offering scrub/trim.
 */
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, Shuffle, Play, Check } from "lucide-react";
import { BEAT_CATALOG, type BeatVariation } from "@/lib/beats";

interface MusicPickerProps {
  open: boolean;
  current: BeatVariation | null;
  playingId: string | null;
  onSelect: (beat: BeatVariation | null) => void;
  onClose: () => void;
}

export function MusicPicker({ open, current, playingId, onSelect, onClose }: MusicPickerProps) {
  // group catalog by family label, preserving catalog order
  const groups = useMemo(() => {
    const map = new Map<string, BeatVariation[]>();
    for (const b of BEAT_CATALOG) {
      const arr = map.get(b.label) ?? [];
      arr.push(b);
      map.set(b.label, arr);
    }
    return [...map.entries()];
  }, []);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-background/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Choose a soundtrack"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="relative z-10 flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  soundtrack · {BEAT_CATALOG.length} grooves
                </p>
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                  synthesized &amp; royalty-free — loops to fit your reel
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {/* shuffle option */}
              <button
                type="button"
                onClick={() => onSelect(null)}
                className={`mb-2 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${
                  current === null ? "border-primary bg-secondary" : "border-border hover:bg-secondary"
                }`}
              >
                <Shuffle className="size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Shuffle</p>
                  <p className="font-mono text-[0.65rem] text-muted-foreground">a fresh groove every reel</p>
                </div>
                {current === null && <Check className="size-4 text-primary" />}
              </button>

              {groups.map(([label, items]) => (
                <div key={label} className="mb-3">
                  <p className="px-1 pb-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
                    {label}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((b) => {
                      const selected = current?.id === b.id;
                      const isPlaying = playingId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => onSelect(b)}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left ${
                            selected ? "border-primary bg-secondary" : "border-border hover:bg-secondary"
                          }`}
                        >
                          {isPlaying ? (
                            <span className="flex size-4 shrink-0 items-center justify-center text-primary">
                              <EqBars />
                            </span>
                          ) : (
                            <Play className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-xs">{b.name}</span>
                          {selected && <Check className="size-3.5 shrink-0 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** tiny animated equalizer for the currently-previewing track */
function EqBars() {
  return (
    <span className="flex items-end gap-[1.5px]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-sm bg-primary"
          animate={{ height: [3, 12, 5, 10, 3] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}
