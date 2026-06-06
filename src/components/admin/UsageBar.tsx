/**
 * Horizontal progress bar for the free-tier usage dashboard.
 *
 * Color ramp (using design tokens from src/index.css):
 *   < 70 %  → neutral foreground fill (monochrome)
 *   70–90 % → --moment (red) at reduced opacity — "amber" stand-in
 *   > 90 %  → --moment (red) at full opacity — critical
 *   No hard limit (null) → static bar / informational only
 */
import { cn } from "@/lib/utils";
import type { UsageServiceResult } from "@/lib/adminApi";

interface UsageBarProps {
  service: UsageServiceResult;
  className?: string;
}

function fmtValue(used: number | null, unit: string): string {
  if (used === null) return "—";
  if (unit === "GB") return `${used.toFixed(3)} GB`;
  if (used >= 1_000_000) return `${(used / 1_000_000).toFixed(2)}M`;
  if (used >= 1_000) return `${(used / 1_000).toFixed(1)}K`;
  return used.toString();
}

function fmtLimit(limit: number | null, unit: string): string {
  if (limit === null) return "no cap";
  if (unit === "GB") return `${limit} GB`;
  if (limit >= 1_000_000) return `${(limit / 1_000_000).toFixed(0)}M`;
  if (limit >= 1_000) return `${(limit / 1_000).toFixed(0)}K`;
  return limit.toString();
}

function periodLabel(period: UsageServiceResult["period"]): string {
  if (period === "day") return "/day";
  if (period === "month") return "/mo";
  return " total";
}

export function UsageBar({ service, className }: UsageBarProps) {
  const { label, limit, unit, period, used, pct, source, note, docUrl } = service;

  const isUnconfigured = source === "unconfigured" || used === null;
  const isNoLimit = limit === null;

  // Effective fill percentage, clamped 0–100
  const fill = pct !== null ? Math.min(100, Math.max(0, pct)) : 0;

  // Determine bar colour tier
  let barColorClass: string;
  if (isUnconfigured || isNoLimit) {
    barColorClass = "bg-muted-foreground/25";
  } else if (fill >= 90) {
    barColorClass = "bg-[var(--moment)]";
  } else if (fill >= 70) {
    barColorClass = "bg-[var(--moment)]/55";
  } else {
    barColorClass = "bg-foreground/70";
  }

  const pctLabel =
    pct !== null
      ? `${pct}%`
      : isNoLimit
        ? "no cap"
        : "—";

  const usedLabel = fmtValue(used, unit);
  const limitLabel = fmtLimit(limit, unit);
  const periodStr = periodLabel(period);

  return (
    <div className={cn("group py-3", className)}>
      {/* Row: label + value/limit */}
      <div className="flex items-baseline justify-between gap-2">
        <a
          href={docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
        >
          {label}
        </a>
        <span className="shrink-0 font-mono text-[0.7rem] tabular-nums text-muted-foreground">
          {isUnconfigured ? (
            <span className="italic">not measured</span>
          ) : (
            <>
              <span className={fill >= 90 ? "text-[var(--moment)]" : fill >= 70 ? "text-[var(--moment)]/80" : "text-foreground"}>
                {usedLabel}
              </span>
              {" / "}
              {limitLabel}
              {" "}
              <span className="text-muted-foreground/60">{unit}{periodStr}</span>
            </>
          )}
        </span>
      </div>

      {/* Progress track */}
      <div
        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? 0}
        aria-label={`${label}: ${pctLabel}`}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", barColorClass)}
          style={{ width: isUnconfigured ? "0%" : `${fill}%` }}
        />
      </div>

      {/* Optional note (unconfigured hint or extra context) */}
      {note && (
        <p className="mt-1 font-mono text-[0.6rem] text-muted-foreground/60 leading-tight">
          {note}
        </p>
      )}
    </div>
  );
}
