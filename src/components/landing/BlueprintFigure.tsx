/**
 * BlueprintFigure — the makingsoftware.com figure plate: a dot-grid panel with a
 * rotated `FIG_00x` rail on the left and a rotated `[ TITLE ]` / `(c) YEAR`
 * caption rail on the right. Strictly monochrome: the diagram inside draws with
 * `currentColor`, so it inverts cleanly between dark and light.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BlueprintFigureProps {
  /** e.g. "FIG_001" */
  fig: string;
  /** e.g. "SYNCHRONIZED CAPTURE" — shown bracketed in the right rail */
  caption: string;
  year?: string;
  children: ReactNode;
  className?: string;
  /** drop the surrounding border (for inline/cropped uses) */
  bare?: boolean;
}

export function BlueprintFigure({
  fig,
  caption,
  year = "2026",
  children,
  className,
  bare = false,
}: BlueprintFigureProps) {
  return (
    <figure
      className={cn(
        "relative grid grid-cols-[1.5rem_minmax(0,1fr)_1.5rem] overflow-hidden sm:grid-cols-[2.25rem_minmax(0,1fr)_2.25rem]",
        !bare && "border border-border",
        "dot-grid bg-card/30",
        className,
      )}
    >
      {/* left rail — figure number, reading bottom-to-top */}
      <div className="flex items-start justify-center pt-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          {fig}
        </span>
      </div>

      {/* center — the diagram */}
      <div className="min-w-0 py-7 sm:py-9">{children}</div>

      {/* right rail — bracketed title + copyright, reading top-to-bottom */}
      <figcaption className="flex flex-col items-center justify-between py-3">
        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground [writing-mode:vertical-rl] sm:text-[9px] sm:tracking-[0.22em]">
          [ {caption} ]
        </span>
        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground/70 [writing-mode:vertical-rl] sm:text-[9px] sm:tracking-[0.18em]">
          (c) {year}
        </span>
      </figcaption>
    </figure>
  );
}
