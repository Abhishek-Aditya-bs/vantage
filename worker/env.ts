/**
 * AppEnv = the generated binding types (global `Env` from worker-configuration.d.ts)
 * plus runtime secrets that are injected via `wrangler secret put` and therefore
 * are not part of the generated config types.
 */
export interface AppEnv extends Env {
  /** HMAC signing secret for capability JWTs — `wrangler secret put JWT_SECRET`. */
  JWT_SECRET?: string;
  /** Turnstile secret — `wrangler secret put TURNSTILE_SECRET`. */
  TURNSTILE_SECRET?: string;
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
