/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Turnstile site key (falls back to the documented test key). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** 'client' (default) attempts an in-browser MP4 export; 'server' defers it. */
  readonly VITE_RENDER_MODE?: "client" | "server";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Runtime config that may be injected on `window` by the host page. */
interface VantageRuntimeConfig {
  turnstileSiteKey?: string;
  renderMode?: "client" | "server";
}

/** Cloudflare Turnstile global (present only when the script has loaded). */
interface TurnstileApi {
  render: (
    el: string | HTMLElement,
    opts: {
      sitekey: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

interface Window {
  __VANTAGE__?: VantageRuntimeConfig;
  turnstile?: TurnstileApi;
}
