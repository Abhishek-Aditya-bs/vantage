/**
 * Host-only "Trigger Moment" control — a prominent moment-red button. Disabled
 * while a Moment is already in flight. Reinforces the camera metaphor with a
 * pulsing ring (the aperture about to fire).
 */
import { motion } from "motion/react";
import { Aperture } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MomentControlProps {
  onTrigger: () => void;
  disabled?: boolean;
  busy?: boolean;
}

export function MomentControl({ onTrigger, disabled, busy }: MomentControlProps) {
  return (
    <div className="relative">
      {!disabled && !busy && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-moment"
          animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.08, 1] }}
          transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
        />
      )}
      <Button
        variant="moment"
        size="lg"
        onClick={onTrigger}
        disabled={disabled || busy}
        className="relative w-full"
      >
        <Aperture className={busy ? "animate-spin" : ""} />
        {busy ? "Scheduling…" : "Trigger Moment"}
      </Button>
    </div>
  );
}
