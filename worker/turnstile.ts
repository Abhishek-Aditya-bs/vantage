/**
 * Cloudflare Turnstile server-side verification (free, unlimited). Gates space
 * creation and joins.
 *
 * Default (no real secret configured): fails OPEN — we never lock out real users
 * for our own infra hiccups or a missing dev secret. Ships this way with the
 * test keys.
 *
 * Phase-2 enforcement: set a real `TURNSTILE_SECRET` to require a valid token.
 * Additionally set `TURNSTILE_ENFORCE=1` to (a) fail CLOSED on infra errors and
 * (b) cross-check the token's `hostname`/`action` claims — strict bot protection.
 */
import type { AppEnv } from "./env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileOptions {
  /** expected hostname the widget was solved on (only enforced when TURNSTILE_ENFORCE=1) */
  hostname?: string;
  /** expected widget action label (only enforced when TURNSTILE_ENFORCE=1) */
  action?: string;
}

interface SiteVerifyResponse {
  success?: boolean;
  hostname?: string;
  action?: string;
  ["error-codes"]?: string[];
}

export async function verifyTurnstile(
  env: AppEnv,
  token: string | undefined,
  ip: string | null,
  opts: TurnstileOptions = {},
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET;
  const enforce = env.TURNSTILE_ENFORCE === "1";

  // No secret → dev/testing. Enforce mode still demands a token be present.
  if (!secret) return !enforce;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as SiteVerifyResponse;
    if (data.success !== true) return false;
    // Strict cross-checks only when explicitly enforcing (test keys return
    // placeholder hostnames, so we must not apply these in the default flow).
    if (enforce) {
      if (opts.hostname && data.hostname && data.hostname !== opts.hostname) return false;
      if (opts.action && data.action && data.action !== opts.action) return false;
    }
    return true;
  } catch {
    // Infra/network error: fail OPEN by default, fail CLOSED when enforcing.
    return !enforce;
  }
}
