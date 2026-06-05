/**
 * Shared constants — the single source of truth for limits and quotas used by
 * BOTH the Worker/Durable Objects and the React client. Tuned to stay safely
 * inside the Cloudflare free tier (no R2, media in DO SQLite ≤ 2 MB/value).
 */

/** Length of a human-shareable space code, e.g. "VNT-7QF" -> stored as "7QF..." */
export const SPACE_CODE_LENGTH = 6;

/** Alphabet for codes — no ambiguous chars (no 0/O/1/I/L). */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const MAX_DISPLAY_NAME = 24;
export const MAX_SPACE_NAME = 48;

/** Durable Object SQLite caps a single value/row at 2 MB. Client compresses below this. */
export const MAX_MEDIA_BYTES = 1_900_000;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/webp",
  "image/png",
] as const;

/** Per-space quotas — keep a viral app inside the free tier. */
export const SPACE_QUOTAS = {
  maxMembers: 50,
  maxMediaItems: 150,
  maxMediaBytes: 300 * 1024 * 1024, // 300 MB per space (DO free cap is 1 GB)
  maxAgeMs: 7 * 24 * 60 * 60 * 1000, // auto-expire after 7 days
} as const;

/** Synchronized-Moment timing. */
export const MOMENT_COUNTDOWN_MS = 3000;
export const MOMENT_COLLECT_WINDOW_MS = 12_000; // grace period to receive frames

/** App-layer rate limits (see RateLimiter DO + in-DO WS throttle). */
export const RATE_LIMITS = {
  createSpace: { limit: 3, windowMs: 60 * 60 * 1000 }, // per IP / hour
  joinSpace: { limit: 10, windowMs: 10 * 60 * 1000 }, // per IP / 10 min
  upload: { limit: 6, windowMs: 60 * 1000 }, // per member / minute
  wsMessage: { limit: 25, windowMs: 10 * 1000 }, // per socket / 10s
  momentTrigger: { limit: 2, windowMs: 60 * 1000 }, // per space / minute
} as const;

export const WS_HEARTBEAT_MS = 25_000;
