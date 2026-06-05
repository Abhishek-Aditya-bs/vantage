/**
 * ASCII colophon footer — a film-strip motif and the product tagline rendered
 * in Space Mono. Deliberately editorial: hairline rule + monospace credits.
 */
import { cn } from "@/lib/utils";

const FILMSTRIP = "▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░";

export function AsciiColophon({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={cn("border-t border-border", className)}>
      <div className="mx-auto w-full max-w-6xl px-5 py-10">
        {/* sprocket / film strip */}
        <pre
          aria-hidden="true"
          className="select-none overflow-hidden font-mono text-[0.7rem] leading-none text-primary/60"
        >
          {FILMSTRIP}
        </pre>

        <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              VANTAGE · multi-angle capture
            </p>
            <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
              every angle. one moment.
            </p>
          </div>
          <pre
            aria-hidden="true"
            className="select-none whitespace-pre font-mono text-[0.65rem] leading-tight text-muted-foreground"
          >
{`  ┌───────────┐
  │ ● ▒▒▒▒▒ ◯ │
  │   VANTAGE │
  └───────────┘`}
          </pre>
        </div>

        <div className="mt-8 flex flex-col gap-1 border-t border-border pt-5 font-mono text-[0.7rem] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} VANTAGE — free · private · ephemeral (7-day spaces)</span>
          <span className="tracking-[0.16em]">
            built for the moment, not the cloud
          </span>
        </div>
      </div>
    </footer>
  );
}
