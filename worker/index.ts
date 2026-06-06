/**
 * Vantage Worker — API gateway + service entry.
 *
 * Flow: the Worker authenticates (capability JWT), challenges (Turnstile), and
 * rate-limits every request, then forwards the already-trusted operation to the
 * space's SpaceRoom Durable Object. Static SPA assets are served by the ASSETS
 * binding (this Worker only runs for /api/* paths).
 */
import { Hono } from "hono";
import { customAlphabet, nanoid } from "nanoid";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, lt } from "drizzle-orm";

import type { AppEnv } from "./env";
import { moderationOn } from "./env";
import { issueToken, verifyToken, DEV_JWT_SECRET } from "./auth";
import { verifyTurnstile } from "./turnstile";
import { moderateImage } from "./moderation";
import { serverRecap, serverRenderAvailable } from "./render";
import { isAdminEmail, createOtp, verifyOtp, issueAdminToken, verifyAdminToken } from "./admin";
import { buildUsageResponse } from "./usage";
import { sendEmail, otpEmail } from "./email";
import { securityHeaders, clientIp } from "./security";
import { checkRate } from "./rate-limiter";
import { spaces } from "./db/schema";
import {
  CreateSpaceBody,
  JoinSpaceBody,
  type AuthResult,
  type MediaMeta,
  type SpacePublic,
  type TokenClaims,
} from "@shared/protocol";
import {
  CODE_ALPHABET,
  SPACE_CODE_LENGTH,
  RATE_LIMITS,
  MAX_MEDIA_BYTES,
  SPACE_QUOTAS,
} from "@shared/constants";

export { SpaceRoom } from "./space-room";
export { RateLimiter } from "./rate-limiter";

type Vars = { claims: TokenClaims };
const app = new Hono<{ Bindings: AppEnv; Variables: Vars }>();

const genCode = customAlphabet(CODE_ALPHABET, SPACE_CODE_LENGTH);
const secretOf = (env: AppEnv) => env.JWT_SECRET ?? DEV_JWT_SECRET;
const roomStub = (env: AppEnv, code: string) =>
  env.SPACE_ROOM.get(env.SPACE_ROOM.idFromName(code.toUpperCase()));
const callRoom = (env: AppEnv, code: string, path: string, init?: RequestInit) =>
  roomStub(env, code).fetch(`https://room${path}`, init);

app.use("/api/*", securityHeaders);

/** Verify the Bearer token and assert it is scoped to `code`. Returns claims or null. */
async function authFor(c: { req: { header: (k: string) => string | undefined }; env: AppEnv }, code: string) {
  const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const claims = await verifyToken(secretOf(c.env), token);
    if (claims.spaceCode.toUpperCase() !== code.toUpperCase()) return null;
    return claims;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------- health
app.get("/api/health", (c) => c.json({ ok: true, app: c.env.APP_NAME }));

// -------------------------------------------------------------- create space
app.post("/api/spaces", async (c) => {
  const ip = clientIp(c);
  if (!(await checkRate(c.env, `create:${ip}`, "create", RATE_LIMITS.createSpace.limit, RATE_LIMITS.createSpace.windowMs)))
    return c.json({ error: "Too many spaces created. Try again later." }, 429);

  const parsed = CreateSpaceBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);
  const { name, hostName, turnstileToken } = parsed.data;

  if (!(await verifyTurnstile(c.env, turnstileToken, ip, { hostname: new URL(c.req.url).hostname, action: "create" })))
    return c.json({ error: "Verification failed. Please retry." }, 403);

  const db = drizzle(c.env.DB);

  // Pick a free, unambiguous code.
  let code = "";
  for (let i = 0; i < 6; i++) {
    const candidate = genCode();
    const taken = await db.select({ c: spaces.code }).from(spaces).where(eq(spaces.code, candidate)).limit(1);
    if (taken.length === 0) { code = candidate; break; }
  }
  if (!code) return c.json({ error: "Could not allocate a space code." }, 503);

  const memberId = nanoid(12);
  const avatarSeed = nanoid(8);
  const now = Date.now();
  const host = { memberId, role: "host" as const, displayName: hostName, avatarSeed, joinedAt: now };

  const initRes = await callRoom(c.env, code, "/init", {
    method: "POST",
    body: JSON.stringify({ name, code, host }),
  });
  if (!initRes.ok) return c.json({ error: "Could not create space." }, 500);
  const space = (await initRes.json()) as SpacePublic;

  await db.insert(spaces).values({ code, name, hostMemberId: memberId, createdAt: now, lastActiveAt: now });

  const token = await issueToken(secretOf(c.env), { memberId, spaceCode: code, role: "host", displayName: hostName, avatarSeed });
  const origin = new URL(c.req.url).origin;
  const result: AuthResult = { token, memberId, role: "host", space, joinUrl: `${origin}/join/${code}` };
  return c.json(result);
});

// ----------------------------------------------------------------- join space
app.post("/api/spaces/:code/join", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const ip = clientIp(c);
  if (!(await checkRate(c.env, `join:${ip}`, "join", RATE_LIMITS.joinSpace.limit, RATE_LIMITS.joinSpace.windowMs)))
    return c.json({ error: "Too many join attempts. Try again later." }, 429);

  const parsed = JoinSpaceBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);
  const { displayName, turnstileToken } = parsed.data;

  if (!(await verifyTurnstile(c.env, turnstileToken, ip, { hostname: new URL(c.req.url).hostname, action: "join" })))
    return c.json({ error: "Verification failed. Please retry." }, 403);

  const memberId = nanoid(12);
  const avatarSeed = nanoid(8);
  const member = { memberId, role: "guest" as const, displayName, avatarSeed, joinedAt: Date.now() };

  const joinRes = await callRoom(c.env, code, "/join", { method: "POST", body: JSON.stringify(member) });
  if (joinRes.status === 404) return c.json({ error: "That space does not exist." }, 404);
  if (joinRes.status === 403) return c.json({ error: "This space is full." }, 403);
  if (!joinRes.ok) return c.json({ error: "Could not join space." }, 500);
  const { space } = (await joinRes.json()) as { space: SpacePublic };

  await drizzle(c.env.DB).update(spaces).set({ lastActiveAt: Date.now() }).where(eq(spaces.code, code));

  const token = await issueToken(secretOf(c.env), { memberId, spaceCode: code, role: "guest", displayName, avatarSeed });
  const origin = new URL(c.req.url).origin;
  const result: AuthResult = { token, memberId, role: "guest", space, joinUrl: `${origin}/join/${code}` };
  return c.json(result);
});

// -------------------------------------------------------------- space preview
app.get("/api/spaces/:code", async (c) => {
  const code = c.req.param("code").toUpperCase();
  if (!(await checkRate(c.env, `read:${clientIp(c)}`, "read", 30, 60_000)))
    return c.json({ error: "Slow down." }, 429);
  const res = await callRoom(c.env, code, "/public");
  if (!res.ok) return c.json({ error: "That space does not exist." }, 404);
  return c.json(await res.json());
});

// ---------------------------------------------------------------- list media
app.get("/api/spaces/:code/media", async (c) => {
  const code = c.req.param("code").toUpperCase();
  if (!(await authFor(c, code))) return c.json({ error: "Unauthorized" }, 401);
  const res = await callRoom(c.env, code, "/media-list");
  return c.json(await res.json());
});

// -------------------------------------------------------------- upload media
app.post("/api/spaces/:code/media", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const claims = await authFor(c, code);
  if (!claims) return c.json({ error: "Unauthorized" }, 401);

  if (!(await checkRate(c.env, `upload:${code}`, claims.sub, RATE_LIMITS.upload.limit, RATE_LIMITS.upload.windowMs)))
    return c.json({ error: "You're uploading too fast." }, 429);

  const buf = await c.req.arrayBuffer();
  if (buf.byteLength === 0) return c.json({ error: "Empty upload" }, 400);
  if (buf.byteLength > MAX_MEDIA_BYTES) return c.json({ error: "Image too large" }, 413);

  // Optional AI moderation (flag-gated, fails open). Off by default.
  if (moderationOn(c.env)) {
    const verdict = await moderateImage(c.env, new Uint8Array(buf));
    if (!verdict.allowed) return c.json({ error: "This image was blocked by moderation." }, 422);
  }

  const res = await callRoom(c.env, code, "/media", {
    method: "POST",
    body: buf,
    headers: {
      "Content-Type": c.req.header("Content-Type") ?? "image/webp",
      "X-Media-Kind": c.req.header("X-Media-Kind") ?? "wall",
      "X-Moment-Id": c.req.header("X-Moment-Id") ?? "",
      "X-Width": c.req.header("X-Width") ?? "0",
      "X-Height": c.req.header("X-Height") ?? "0",
      "X-Member-Id": claims.sub,
      "X-Display-Name": claims.displayName,
    },
  });
  return new Response(res.body, { status: res.status, headers: { "Content-Type": "application/json" } });
});

// --------------------------------------------------- public media bytes (img)
app.get("/api/m/:code/:id", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const id = c.req.param("id");
  return callRoom(c.env, code, `/media/${encodeURIComponent(id)}`);
});

// ------------------------------------------------------------ trigger moment
app.post("/api/spaces/:code/moment", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const claims = await authFor(c, code);
  if (!claims) return c.json({ error: "Unauthorized" }, 401);
  if (claims.role !== "host") return c.json({ error: "Only the host can trigger a Moment." }, 403);
  if (!(await checkRate(c.env, `moment:${code}`, "moment", RATE_LIMITS.momentTrigger.limit, RATE_LIMITS.momentTrigger.windowMs)))
    return c.json({ error: "Moments are rate-limited. Wait a moment." }, 429);

  const res = await callRoom(c.env, code, "/moment", { method: "POST", headers: { "X-Member-Id": claims.sub } });
  return c.json(await res.json());
});

// -------------------------------------------------------- recap render (Phase-2)
/** Probe: tells the client whether a server render is available for this space. */
app.get("/api/spaces/:code/recap", async (c) => {
  const code = c.req.param("code").toUpperCase();
  if (!(await authFor(c, code))) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ mode: serverRenderAvailable(c.env) ? "server" : "client" });
});

/**
 * Render the recap. With RENDER_MODE=server + a bound container, this returns a
 * finished `video/mp4`. Otherwise it returns `{ mode: "client" }` so the client
 * falls back to its on-device export (the free default path). Inert by default.
 */
app.post("/api/spaces/:code/recap", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const claims = await authFor(c, code);
  if (!claims) return c.json({ error: "Unauthorized" }, 401);
  if (!serverRenderAvailable(c.env)) return c.json({ mode: "client" }, 200);

  // Server renders are expensive — rate-limit them per space.
  if (!(await checkRate(c.env, `recap:${code}`, "recap", 3, 5 * 60_000)))
    return c.json({ error: "Recaps are rate-limited. Try again shortly." }, 429);

  const listRes = await callRoom(c.env, code, "/media-list");
  const { media } = (await listRes.json()) as { media: MediaMeta[] };
  if (!media.length) return c.json({ error: "Nothing to recap yet." }, 400);

  const origin = new URL(c.req.url).origin;
  const frames = [...media]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((m) => ({ url: `${origin}/api/m/${code}/${encodeURIComponent(m.id)}`, displayName: m.displayName }));

  const res = await serverRecap(c.env, { title: code, width: 1080, height: 1920, msPerFrame: 2200, frames });
  if (!res.ok) return c.json({ error: "Render failed." }, 502);
  return new Response(res.body, {
    status: 200,
    headers: { "Content-Type": "video/mp4", "Cache-Control": "no-store" },
  });
});

// -------------------------------------------------------------- token refresh
app.post("/api/token/refresh", async (c) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  try {
    const claims = await verifyToken(secretOf(c.env), token);
    const fresh = await issueToken(secretOf(c.env), {
      memberId: claims.sub, spaceCode: claims.spaceCode, role: claims.role,
      displayName: claims.displayName, avatarSeed: claims.avatarSeed,
    });
    return c.json({ token: fresh });
  } catch {
    return c.json({ error: "Token expired — please rejoin." }, 401);
  }
});

// ----------------------------------------------------------- websocket upgrade
app.get("/api/spaces/:code/ws", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") return c.json({ error: "Expected WebSocket" }, 426);
  const code = c.req.param("code").toUpperCase();
  const token = c.req.query("t");
  if (!token) return c.json({ error: "Missing token" }, 401);
  let claims: TokenClaims;
  try {
    claims = await verifyToken(secretOf(c.env), token);
    if (claims.spaceCode.toUpperCase() !== code) return c.json({ error: "Token/space mismatch" }, 401);
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
  return roomStub(c.env, code).fetch(`https://room/ws`, {
    headers: {
      Upgrade: "websocket",
      "X-Member-Id": claims.sub,
      "X-Role": claims.role,
      "X-Display-Name": claims.displayName,
      "X-Avatar-Seed": claims.avatarSeed,
    },
  });
});

// ====================================================== admin dashboard (OTP)
type RoomStats = { memberCount: number; liveCount: number; mediaCount: number; bytes: number };

/** Bearer admin-JWT guard → admin email, or null. */
async function adminAuth(c: {
  req: { header: (k: string) => string | undefined };
  env: AppEnv;
}): Promise<string | null> {
  const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return verifyAdminToken(c.env, token);
}

/** Step 1 — request an OTP (emailed to the allowlisted admin, if Resend is set). */
app.post("/api/admin/login/request", async (c) => {
  const ip = clientIp(c);
  if (!(await checkRate(c.env, `adminotp:${ip}`, "adminotp", 6, 10 * 60_000)))
    return c.json({ error: "Too many attempts. Try again later." }, 429);
  const body = (await c.req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim();
  let emailSent = false;
  if (isAdminEmail(c.env, email)) {
    const code = await createOtp(c.env, email);
    if (c.env.RESEND_API_KEY) emailSent = await sendEmail(c.env, { to: email, ...otpEmail(code) });
  }
  // Generic response; `emailSent` only hints whether to expect a code by email.
  return c.json({ ok: true, emailSent });
});

/** Step 2 — verify the OTP (or master passcode) → admin session token. */
app.post("/api/admin/login/verify", async (c) => {
  const ip = clientIp(c);
  if (!(await checkRate(c.env, `adminverify:${ip}`, "adminverify", 10, 10 * 60_000)))
    return c.json({ error: "Too many attempts. Try again later." }, 429);
  const body = (await c.req.json().catch(() => ({}))) as { email?: string; code?: string };
  const email = (body.email ?? "").trim();
  const code = (body.code ?? "").trim();
  if (!isAdminEmail(c.env, email)) return c.json({ error: "Not authorized." }, 401);
  if (!(await verifyOtp(c.env, email, code))) return c.json({ error: "Invalid or expired code." }, 401);
  const token = await issueAdminToken(c.env, email);
  return c.json({ token });
});

/** Dashboard data — every space with live/photo/size stats + totals. */
app.get("/api/admin/spaces", async (c) => {
  if (!(await adminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(spaces);
  const list: Array<{
    code: string; name: string; status: string; createdAt: number; lastActiveAt: number;
    members: number; live: number; photos: number; bytes: number;
  }> = [];
  let totalPhotos = 0, totalLive = 0, totalBytes = 0, totalMembers = 0;
  for (const row of rows) {
    let stats: RoomStats | null = null;
    try {
      const r = await callRoom(c.env, row.code, "/stats");
      if (r.ok) stats = (await r.json()) as RoomStats;
    } catch {
      /* DO unreachable → null stats */
    }
    totalPhotos += stats?.mediaCount ?? 0;
    totalLive += stats?.liveCount ?? 0;
    totalBytes += stats?.bytes ?? 0;
    totalMembers += stats?.memberCount ?? 0;
    list.push({
      code: row.code, name: row.name, status: row.status,
      createdAt: row.createdAt, lastActiveAt: row.lastActiveAt,
      members: stats?.memberCount ?? 0, live: stats?.liveCount ?? 0,
      photos: stats?.mediaCount ?? 0, bytes: stats?.bytes ?? 0,
    });
  }
  list.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return c.json({
    spaces: list,
    totals: { spaces: rows.length, photos: totalPhotos, live: totalLive, bytes: totalBytes, members: totalMembers },
  });
});

/** Free-tier usage snapshot — measured values + optional CF Analytics data. */
app.get("/api/admin/usage", async (c) => {
  if (!(await adminAuth(c))) return c.json({ error: "Unauthorized" }, 401);

  const db = drizzle(c.env.DB);
  const rows = await db.select().from(spaces);

  let totalBytes = 0;
  let totalMedia = 0;
  let totalMembers = 0;
  for (const row of rows) {
    try {
      const r = await callRoom(c.env, row.code, "/stats");
      if (r.ok) {
        const stats = (await r.json()) as RoomStats;
        totalBytes += stats.bytes;
        totalMedia += stats.mediaCount;
        totalMembers += stats.memberCount;
      }
    } catch {
      /* DO unreachable — skip */
    }
  }

  const response = await buildUsageResponse(
    totalBytes,
    rows.length,
    totalMedia,
    totalMembers,
    c.env.CF_API_TOKEN,
    c.env.CF_ACCOUNT_ID,
  );
  return c.json(response);
});

/** Delete one space (purge its DO + remove from the registry). */
app.delete("/api/admin/spaces/:code", async (c) => {
  if (!(await adminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
  const code = c.req.param("code").toUpperCase();
  try {
    await callRoom(c.env, code, "/purge");
  } catch {
    /* best effort */
  }
  await drizzle(c.env.DB).delete(spaces).where(eq(spaces.code, code));
  return c.json({ ok: true });
});

/** Nuke everything (purge all DOs + clear the registry). */
app.post("/api/admin/wipe", async (c) => {
  if (!(await adminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
  const db = drizzle(c.env.DB);
  const rows = await db.select({ code: spaces.code }).from(spaces);
  let purged = 0;
  for (const { code } of rows) {
    try {
      await callRoom(c.env, code, "/purge");
      purged += 1;
    } catch {
      /* keep going */
    }
  }
  await db.delete(spaces);
  return c.json({ spaces: rows.length, purged });
});

// -------------------------------------------------------------- admin reset
/**
 * Maintenance: purge every space's Durable Object and clear the D1 registry —
 * a clean slate. Disabled (403) unless ADMIN_SECRET is configured, and then
 * gated by a matching `X-Admin-Secret` header.
 */
app.post("/api/admin/reset", async (c) => {
  const secret = c.env.ADMIN_SECRET;
  if (!secret) return c.json({ error: "Disabled." }, 403);
  if (c.req.header("X-Admin-Secret") !== secret) return c.json({ error: "Unauthorized" }, 401);

  const db = drizzle(c.env.DB);
  const rows = await db.select({ code: spaces.code }).from(spaces);
  let purged = 0;
  for (const { code } of rows) {
    try {
      await callRoom(c.env, code, "/purge");
      purged += 1;
    } catch {
      /* keep going — best effort */
    }
  }
  await db.delete(spaces);
  return c.json({ spaces: rows.length, purged });
});

// SPA fallback (the Worker normally only runs for /api/*, but be safe).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

/** Cron: expire spaces inactive beyond the quota window. */
async function expireSpaces(env: AppEnv): Promise<void> {
  const db = drizzle(env.DB);
  const cutoff = Date.now() - SPACE_QUOTAS.maxAgeMs;
  const stale = await db.select({ code: spaces.code }).from(spaces)
    .where(and(lt(spaces.lastActiveAt, cutoff), eq(spaces.status, "active")));
  for (const { code } of stale) {
    await callRoom(env, code, "/purge");
    await db.update(spaces).set({ status: "deleted" }).where(eq(spaces.code, code));
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: AppEnv): Promise<void> {
    await expireSpaces(env);
  },
} satisfies ExportedHandler<AppEnv>;
