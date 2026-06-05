/**
 * A small lo-fi phone frame used in the "how a Moment works" visual.
 * Pure SVG/CSS — its screen flashes moment-red at the synchronized instant.
 */
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PhoneFrameProps {
  /** 0..1 within the demo cycle when this phone flashes (kept staggered ~0) */
  flash?: boolean;
  tilt?: number;
  className?: string;
  children?: ReactNode;
}

export function PhoneFrame({
  flash = false,
  tilt = 0,
  className,
  children,
}: PhoneFrameProps) {
  return (
    <motion.div
      className={cn(
        "relative aspect-[9/19] w-full rounded-[1.25rem] border-2 border-foreground/80 bg-card p-1.5 shadow-md",
        className,
      )}
      style={{ rotate: tilt }}
      animate={flash ? { borderColor: ["var(--foreground)", "var(--moment)", "var(--foreground)"] } : {}}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      {/* notch */}
      <div className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 rounded-full bg-foreground/40" />
      {/* screen */}
      <motion.div
        className="grid h-full w-full place-items-center overflow-hidden rounded-[0.85rem] bg-secondary"
        animate={
          flash
            ? { backgroundColor: ["var(--secondary)", "var(--moment)", "var(--secondary)"] }
            : {}
        }
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
