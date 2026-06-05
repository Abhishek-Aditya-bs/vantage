/**
 * "How a Moment works" — three phones around a subject that all flash at the
 * SAME instant, illustrating synchronized multi-angle capture. The flash is
 * driven by a single shared timer so all three fire together, then the
 * "artifact" (a contact-sheet of the three angles) assembles.
 */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { PhoneFrame } from "./PhoneFrame";
import { IrisShutter } from "@/components/brand/IrisShutter";

const ANGLES = [
  { tilt: -8, label: "ANGLE A" },
  { tilt: 0, label: "ANGLE B" },
  { tilt: 8, label: "ANGLE C" },
];

export function HowAMomentWorks() {
  // demo phases: idle -> counting -> FLASH -> assembled, then loop
  const [phase, setPhase] = useState<"idle" | "count" | "flash" | "done">(
    "idle",
  );

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setPhase("done");
      return;
    }
    let timers: number[] = [];
    const run = () => {
      setPhase("count");
      timers.push(
        window.setTimeout(() => setPhase("flash"), 1600),
        window.setTimeout(() => setPhase("done"), 2200),
        window.setTimeout(() => {
          setPhase("idle");
          run();
        }, 5200),
      );
    };
    const start = window.setTimeout(run, 600);
    return () => {
      window.clearTimeout(start);
      timers.forEach(window.clearTimeout);
    };
  }, []);

  const counting = phase === "count";
  const flashing = phase === "flash";
  const assembled = phase === "done";

  return (
    <div className="relative">
      {/* the three capturing phones */}
      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        {ANGLES.map((a) => (
          <div key={a.label} className="flex flex-col items-center gap-2">
            <PhoneFrame flash={flashing} tilt={a.tilt} className="max-w-[7.5rem]">
              {counting ? (
                <IrisShutter size={56} active progress={0.6} />
              ) : assembled ? (
                <div className="grid h-full w-full place-items-center bg-card">
                  <div className="grid grid-cols-2 grid-rows-2 gap-0.5 p-1.5">
                    {Array.from({ length: 4 }).map((_, k) => (
                      <span
                        key={k}
                        className="size-3 bg-primary/70"
                        style={{ opacity: 0.5 + (k % 3) * 0.2 }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid size-full place-items-center text-muted-foreground">
                  <span className="font-mono text-[0.6rem]">●REC</span>
                </div>
              )}
            </PhoneFrame>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
              {a.label}
            </span>
          </div>
        ))}
      </div>

      {/* synchronization line — the shared instant */}
      <div className="mt-6 flex items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground">T</span>
        <div className="relative h-px flex-1 bg-border">
          <motion.span
            className="absolute -top-1 size-2.5 rounded-full bg-moment"
            initial={false}
            animate={{
              left: flashing || assembled ? "100%" : counting ? "60%" : "0%",
              opacity: phase === "idle" ? 0.4 : 1,
            }}
            transition={{ duration: counting ? 1.6 : 0.4, ease: "easeInOut" }}
            style={{ translateX: "-50%" }}
          />
        </div>
        <span className="font-mono text-xs font-bold text-moment">T₀</span>
      </div>
      <p
        className="mt-3 text-center font-mono text-xs text-muted-foreground"
        aria-live="polite"
      >
        {counting
          ? "syncing clocks · 3 · 2 · 1 …"
          : flashing
            ? "▟ every phone captures the same instant"
            : assembled
              ? "→ one multi-angle artifact"
              : "waiting for the Moment"}
      </p>
    </div>
  );
}
