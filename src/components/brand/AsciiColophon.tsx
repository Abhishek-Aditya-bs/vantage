/**
 * Colophon footer — a ░ ruled row, the wordmark + tagline, an ASCII camera
 * plate, and the legal line. Monochrome and editorial: hairline rules and
 * Geist Mono credits in the reference-manual register.
 */
import { cn } from "@/lib/utils";

export function AsciiColophon({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={cn("border-t border-border", className)}>
      <div
        aria-hidden="true"
        className="shade-row w-full overflow-hidden px-5 pt-8 text-[0.7rem] leading-none tracking-[0.05em] sm:px-8"
      >
        {"░".repeat(400)}
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.26em] text-muted-foreground">
              Vantage · multi-angle capture
            </p>
            <p className="mt-3 font-display text-2xl font-semibold tracking-tight">Every angle. One instant.</p>
          </div>
          <pre
            aria-hidden="true"
            className="select-none whitespace-pre font-mono text-[0.65rem] leading-tight text-muted-foreground"
          >
{`  +-----------+
  | [o]  ::: o|
  |  VANTAGE  |
  +-----------+`}
          </pre>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 font-mono text-[0.7rem] uppercase tracking-[0.06em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} Vantage — free · private · ephemeral (7-day spaces)</span>
          <span className="tracking-[0.16em]">built for the moment, not the cloud</span>
        </div>
      </div>
    </footer>
  );
}
