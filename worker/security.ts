/**
 * Security headers + CORS helpers applied to API responses by the Hono app.
 * (The HTML shell additionally gets CSP via `public/_headers`.)
 */
import type { Context, Next } from "hono";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

/** Hono middleware: attach hardening headers to every response. */
export async function securityHeaders(c: Context, next: Next): Promise<void> {
  await next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.header(k, v);
}

/** First three octets of the client IP — used to shard/scope rate limiters. */
export function clientIp(c: Context): string {
  return c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "0.0.0.0";
}
