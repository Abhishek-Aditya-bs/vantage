/**
 * PixelHeadline — renders text in Geist Mono run through an SVG pixelate filter,
 * the makingsoftware.com headline trick (it's a filter, not a bitmap font, so it
 * stays crisp at any scale and inherits `currentColor`, tracking the theme).
 *
 * The filter samples the glyph coverage at the centre of each NxN cell and
 * dilates that sample back out to a square block, leaving a 1px gutter so it
 * reads as a pixel grid.
 */
import { useId } from "react";
import { cn } from "@/lib/utils";

interface PixelHeadlineProps {
  text: string;
  /** rendered cap height in px (the SVG scales to it) */
  height?: number;
  /** pixel cell size in viewBox units; larger = chunkier */
  cell?: number;
  /** advance width per char as a fraction of font size (Geist Mono ≈ 0.6) */
  advance?: number;
  className?: string;
  title?: string;
}

export function PixelHeadline({
  text,
  height = 44,
  cell = 7,
  advance = 0.6,
  className,
  title,
}: PixelHeadlineProps) {
  const id = useId().replace(/:/g, "");
  const filterId = `px-${id}`;

  // Author the type at a fixed nominal size, then let the SVG scale to `height`.
  const FS = 80; // nominal font-size in viewBox units
  const pad = cell * 2; // breathing room so dilated blocks aren't clipped
  const w = Math.ceil(text.length * FS * advance) + pad * 2;
  const h = Math.ceil(FS * 1.18) + pad;
  const baseline = pad + FS;
  // dilate radius ≈ half a cell, minus ~0.6px to keep a visible grid gutter
  const radius = (cell / 2 - 0.6).toFixed(2);
  const dot = (cell / 2).toFixed(2);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      height={height}
      width={(height * w) / h}
      className={cn("block max-w-full", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      preserveAspectRatio="xMinYMid meet"
    >
      <defs>
        <filter
          id={filterId}
          x={0}
          y={0}
          width={w}
          height={h}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          {/* one sample dot at the centre of a cell */}
          <feFlood x={dot} y={dot} width="1" height="1" floodColor="#fff" result="dot" />
          {/* clip it to a single NxN cell */}
          <feComposite in="dot" width={cell} height={cell} result="cell" />
          {/* tile the cell across the whole text */}
          <feTile in="cell" result="grid" />
          {/* keep glyph coverage only where the grid samples it */}
          <feComposite in="SourceGraphic" in2="grid" operator="in" result="samp" />
          {/* grow each sample back into a block */}
          <feMorphology in="samp" operator="dilate" radius={radius} />
        </filter>
      </defs>
      <text
        x={pad}
        y={baseline}
        fontFamily="var(--font-mono)"
        fontSize={FS}
        fontWeight={600}
        letterSpacing={`${-FS * 0.04}`}
        style={{ textTransform: "uppercase" }}
        fill="currentColor"
        filter={`url(#${filterId})`}
      >
        {text.toUpperCase()}
      </text>
    </svg>
  );
}
