/**
 * Cloudflare Turnstile widget wrapper.
 *
 * - Renders the `cf-turnstile` container and, if the Turnstile global is
 *   present, mounts an explicit widget so we can capture the token.
 * - If the script/global is absent (dev), it reports "ready with no token" so
 *   the parent form can submit anyway (a documented dev fallback).
 * - Re-renders cleanly on theme change by reading the resolved theme.
 */
import { useEffect, useId, useRef, useState } from "react";
import { turnstileSiteKey } from "@/lib/config";
import { useTheme } from "@/providers/ThemeProvider";

interface TurnstileProps {
  /** called with a token (real Turnstile) or null (dev fallback / reset) */
  onToken: (token: string | null) => void;
  className?: string;
}

export function Turnstile({ onToken, className }: TurnstileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const reactId = useId();
  const { theme } = useTheme();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Poll briefly for the Turnstile global (the script loads async).
    let cancelled = false;
    let tries = 0;
    let timer: number;

    const tryRender = () => {
      if (cancelled) return;
      const ts = window.turnstile;
      if (ts && el) {
        try {
          widgetId.current = ts.render(el, {
            sitekey: turnstileSiteKey(),
            theme,
            callback: (token) => onToken(token),
            "error-callback": () => onToken(null),
            "expired-callback": () => onToken(null),
          });
        } catch {
          setUnavailable(true);
          onToken(null); // dev fallback
        }
        return;
      }
      if (tries++ < 25) {
        timer = window.setTimeout(tryRender, 200);
      } else {
        // No Turnstile script present — allow submit as a dev fallback.
        setUnavailable(true);
        onToken(null);
      }
    };

    tryRender();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const ts = window.turnstile;
      if (ts && widgetId.current) {
        try {
          ts.remove(widgetId.current);
        } catch {
          /* ignore */
        }
      }
      widgetId.current = null;
    };
    // Re-mount the widget when theme changes so it matches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <div className={className}>
      {/* The class lets implicit-mode Turnstile also pick it up if configured. */}
      <div ref={ref} id={reactId} className="cf-turnstile" />
      {unavailable && (
        <p className="mt-1.5 font-mono text-[0.7rem] text-muted-foreground">
          verification skipped (dev)
        </p>
      )}
    </div>
  );
}
