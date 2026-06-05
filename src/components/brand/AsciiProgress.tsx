/**
 * Block-character (░▒▓█) progress bar in Space Mono — used for processing /
 * upload states. Accessible via role="progressbar".
 */
import { blockBar } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AsciiProgressProps {
  /** 0..1 */
  value: number;
  width?: number;
  label?: string;
  className?: string;
}

export function AsciiProgress({
  value,
  width = 16,
  label,
  className,
}: AsciiProgressProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const pct = Math.round(clamped * 100);
  return (
    <div
      className={cn("font-mono text-xs leading-none", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label ?? "Progress"}
    >
      <span className="text-primary">[</span>
      <span className="text-foreground tracking-[-0.05em]" aria-hidden="true">
        {blockBar(clamped, width)}
      </span>
      <span className="text-primary">]</span>
      <span className="ml-2 text-muted-foreground tabular-nums">
        {pct.toString().padStart(3, " ")}%
      </span>
    </div>
  );
}
