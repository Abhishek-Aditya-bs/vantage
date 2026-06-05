/**
 * RateLimiter — a dedicated Durable Object implementing an approximate
 * sliding-window limiter (fixed-window + previous-window weighting). Strongly
 * consistent and single-threaded, so no races. In-memory hot path; SQLite
 * persists across hibernation. KV/D1 would be wrong here (eventual consistency /
 * write-cap), which is exactly why this lives in a DO.
 */
import { DurableObject } from "cloudflare:workers";
import type { AppEnv, RateLimiterRpc } from "./env";

interface Win {
  prev: number;
  curr: number;
  start: number;
}

export class RateLimiter extends DurableObject<AppEnv> implements RateLimiterRpc {
  private mem = new Map<string, Win>();

  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS windows (
        key TEXT PRIMARY KEY,
        prev INTEGER NOT NULL,
        curr INTEGER NOT NULL,
        start INTEGER NOT NULL
      )`,
    );
  }

  async check(
    key: string,
    limit: number,
    windowMs: number,
    now: number,
  ): Promise<{ allowed: boolean; retryAfterMs: number }> {
    let w = this.mem.get(key);
    if (!w) {
      const row = this.ctx.storage.sql
        .exec<{ prev: number; curr: number; start: number }>(
          `SELECT prev, curr, start FROM windows WHERE key = ?`,
          key,
        )
        .toArray()[0];
      w = row ?? { prev: 0, curr: 0, start: now };
    }

    // Roll the window if the current one expired.
    if (now - w.start >= windowMs) {
      const rolledOnce = now - w.start < 2 * windowMs;
      w = { prev: rolledOnce ? w.curr : 0, curr: 0, start: now };
    }

    const elapsed = now - w.start;
    const weight = w.prev * Math.max(0, (windowMs - elapsed) / windowMs) + w.curr;

    if (weight >= limit) {
      return { allowed: false, retryAfterMs: Math.max(0, w.start + windowMs - now) };
    }

    w.curr += 1;
    this.mem.set(key, w);
    this.ctx.storage.sql.exec(
      `INSERT INTO windows (key, prev, curr, start) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET prev=excluded.prev, curr=excluded.curr, start=excluded.start`,
      key,
      w.prev,
      w.curr,
      w.start,
    );
    return { allowed: true, retryAfterMs: 0 };
  }
}

/** Worker-side helper: shard by key, call the limiter via RPC, return allow/deny. */
export async function checkRate(
  env: AppEnv,
  shard: string,
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const id = env.RATE_LIMITER.idFromName(shard);
  const stub = env.RATE_LIMITER.get(id) as unknown as RateLimiterRpc;
  const res = await stub.check(bucketKey, limit, windowMs, Date.now());
  return res.allowed;
}
