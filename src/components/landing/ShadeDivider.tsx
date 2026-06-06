/**
 * ShadeDivider — the signature ░ ruled row that separates sections in a printed
 * reference manual. A single clipped line of U+2591 (light shade) at low
 * contrast. Purely decorative.
 */
import { cn } from "@/lib/utils";

export function ShadeDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "shade-row pointer-events-none w-full text-[0.7rem] leading-none tracking-[0.05em]",
        className,
      )}
    >
      {"░".repeat(400)}
    </div>
  );
}
