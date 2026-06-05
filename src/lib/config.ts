/**
 * Runtime configuration resolution.
 * Precedence: build-time Vite env  ->  window.__VANTAGE__  ->  documented default.
 */

/** Cloudflare's always-passing test site key (safe public default). */
const TURNSTILE_TEST_KEY = "1x00000000000000000000AA";

export function turnstileSiteKey(): string {
  return (
    import.meta.env.VITE_TURNSTILE_SITE_KEY ||
    window.__VANTAGE__?.turnstileSiteKey ||
    TURNSTILE_TEST_KEY
  );
}

export type RenderMode = "client" | "server";

export function renderMode(): RenderMode {
  return (
    import.meta.env.VITE_RENDER_MODE ||
    window.__VANTAGE__?.renderMode ||
    "client"
  );
}

/** True when the in-browser WebCodecs encoder is available for MP4 export. */
export function hasWebCodecs(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder !==
      "undefined"
  );
}
