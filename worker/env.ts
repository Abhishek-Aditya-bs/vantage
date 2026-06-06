/**
 * AppEnv = the generated binding types (global `Env` from worker-configuration.d.ts)
 * plus runtime secrets injected via `wrangler secret put`, plus Phase-2 bindings
 * that are declared OPTIONAL so the app type-checks and deploys on the free tier
 * with them absent. Flipping a feature flag + uncommenting the matching binding in
 * `wrangler.jsonc` is all it takes to light each one up.
 *
 * Note: `wrangler types` narrows `vars` to string LITERALS (e.g. `STORAGE_MODE: "do"`).
 * We widen the feature flags to their full unions here so flag comparisons compile.
 */

/** Where media BLOBs live. `do` = Durable Object SQLite (free). `r2` = Phase-2 bucket. */
export type StorageMode = "do" | "r2";
/** How the recap is rendered. `client` = on-device (free). `server` = Phase-2 ffmpeg container. */
export type RenderMode = "client" | "server";
/** Image moderation. `off` = none (free default). `on` = Workers AI screening on upload. */
export type ModerationMode = "off" | "on";

export interface AppEnv extends Omit<Env, "STORAGE_MODE" | "RENDER_MODE"> {
  // ---- feature flags (widened from the generated literal types) ------------
  STORAGE_MODE: StorageMode;
  RENDER_MODE: RenderMode;
  /** Optional; defaults to "off" when unset. Set via `vars` to enable AI moderation. */
  MODERATION_MODE?: ModerationMode;
  /** Optional Workers AI model id for moderation (overrides the built-in default). */
  MODERATION_MODEL?: string;

  // ---- secrets (wrangler secret put) ---------------------------------------
  /** HMAC signing secret for capability JWTs — `wrangler secret put JWT_SECRET`. */
  JWT_SECRET?: string;
  /** Turnstile secret — `wrangler secret put TURNSTILE_SECRET`. */
  TURNSTILE_SECRET?: string;
  /** Shared secret guarding the render container endpoint — `wrangler secret put RENDER_SECRET`. */
  RENDER_SECRET?: string;
  /** "1" to enforce Turnstile strictly (no fail-open on infra errors). */
  TURNSTILE_ENFORCE?: string;
  /**
   * Admin maintenance secret. When set, enables `POST /api/admin/reset` (purges
   * every space DO + clears the D1 registry). Leave unset in normal operation so
   * the endpoint stays disabled (403). `wrangler secret put ADMIN_SECRET`.
   */
  ADMIN_SECRET?: string;
  /** The single email allowed into the admin dashboard. Defaults to ADMIN_EMAIL_FALLBACK. */
  ADMIN_EMAIL?: string;
  /** Master passcode for the admin dashboard (bootstrap / no-email fallback). `wrangler secret put ADMIN_PASSCODE`. */
  ADMIN_PASSCODE?: string;
  /** Resend API key — enables emailing the admin OTP. `wrangler secret put RESEND_API_KEY`. */
  RESEND_API_KEY?: string;

  // ---- Phase-2 bindings (optional; declared in wrangler.jsonc when enabled) -
  /** R2 bucket for media when STORAGE_MODE=r2. Bind as `MEDIA_BUCKET`. */
  MEDIA_BUCKET?: R2Bucket;
  /**
   * Container-backed recap renderer when RENDER_MODE=server. Bind as a Durable
   * Object namespace whose class extends `@cloudflare/containers` `Container`.
   * We only ever call the standard stub `.fetch()`, so the namespace type alone
   * keeps the Worker type-checking without the container package installed.
   */
  RECAP_RENDERER?: DurableObjectNamespace;
}

/** Minimal RPC surface of the RateLimiter DO (the generated namespace is untyped). */
export interface RateLimiterRpc {
  check(
    key: string,
    limit: number,
    windowMs: number,
    now: number,
  ): Promise<{ allowed: boolean; retryAfterMs: number }>;
}

/* ----------------------------- flag accessors ----------------------------- */
/** Resolve the storage backend (defaults to DO SQLite). */
export const storageMode = (env: AppEnv): StorageMode =>
  env.STORAGE_MODE === "r2" ? "r2" : "do";
/** Resolve the render backend (defaults to on-device). */
export const renderMode = (env: AppEnv): RenderMode =>
  env.RENDER_MODE === "server" ? "server" : "client";
/** Whether AI moderation is enabled (defaults off). */
export const moderationOn = (env: AppEnv): boolean => env.MODERATION_MODE === "on";

/** The single email permitted into the admin dashboard. */
const ADMIN_EMAIL_FALLBACK = "abhishek.aditya10@gmail.com";
export const adminEmail = (env: AppEnv): string =>
  (env.ADMIN_EMAIL ?? ADMIN_EMAIL_FALLBACK).trim().toLowerCase();
