/**
 * SpaceRoom — one Durable Object per space (addressed by space code).
 *
 * Responsibilities:
 *   - Live realtime fabric over WebSockets (Hibernation API → idle sockets are free)
 *   - Presence (who is here now), the live media wall, and synchronized "Moments"
 *   - Media BLOB storage in the DO's own SQLite (no R2 needed → pure free tier).
 *     SQLite caps a value at 2 MB; the client compresses below MAX_MEDIA_BYTES.
 *   - Per-space quotas to stay inside the free tier.
 *
 * The Worker is the gatekeeper (JWT, Turnstile, rate limits) and forwards already-
 * authenticated requests here with the caller's identity in `X-Member-*` headers.
 */
import { DurableObject } from "cloudflare:workers";
import { nanoid } from "nanoid";
import type { AppEnv } from "./env";
import type {
  Member,
  MediaMeta,
  MediaKind,
  Role,
  SpacePublic,
  ServerMessage,
  ClientMessage,
} from "@shared/protocol";
import {
  SPACE_QUOTAS,
  MOMENT_COUNTDOWN_MS,
  MOMENT_COLLECT_WINDOW_MS,
  MAX_MEDIA_BYTES,
  RATE_LIMITS,
} from "@shared/constants";

interface Attachment {
  memberId: string;
  role: Role;
  displayName: string;
  avatarSeed: string;
  joinedAt: number;
}

type MediaRow = {
  id: string;
  kind: MediaKind;
  moment_id: string | null;
  member_id: string;
  display_name: string;
  content_type: string;
  width: number;
  height: number;
  created_at: number;
};

export class SpaceRoom extends DurableObject<AppEnv> {
  /** per-socket WS message rate-limit counters (in-memory; resets on hibernation wake — fine) */
  private wsHits = new WeakMap<WebSocket, { count: number; start: number }>();

  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    const sql = this.ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS meta (
      k TEXT PRIMARY KEY, name TEXT, code TEXT, host_member_id TEXT, created_at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS members (
      member_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, role TEXT NOT NULL,
      avatar_seed TEXT NOT NULL, joined_at INTEGER NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, moment_id TEXT, member_id TEXT NOT NULL,
      display_name TEXT NOT NULL, content_type TEXT NOT NULL, width INTEGER NOT NULL,
      height INTEGER NOT NULL, created_at INTEGER NOT NULL, bytes BLOB NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS moments (
      moment_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, triggered_by TEXT NOT NULL,
      capture_at INTEGER NOT NULL, finalize_at INTEGER NOT NULL, status TEXT NOT NULL)`);
  }

  // ----------------------------------------------------------------- routing
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/ws") return this.handleUpgrade(request);
      if (path === "/init") return this.json(await this.init(request));
      if (path === "/public") return this.publicInfoResponse();
      if (path === "/join") return this.json(await this.join(request));
      if (path === "/media-list") return this.json({ media: this.wallSnapshot() });
      if (path === "/media" && request.method === "POST") return this.json(await this.addMedia(request));
      if (path.startsWith("/media/")) return this.getMediaBytes(path.slice("/media/".length));
      if (path === "/moment" && request.method === "POST") return this.json(await this.triggerMoment(request));
      if (path === "/purge") { await this.ctx.storage.deleteAll(); return new Response("ok"); }
      return new Response("not found", { status: 404 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "error";
      const status = message.startsWith("4") ? Number(message.slice(0, 3)) : 500;
      return this.json({ error: message }, Number.isFinite(status) ? status : 500);
    }
  }

  // -------------------------------------------------------------- lifecycle
  private exists(): boolean {
    return this.ctx.storage.sql.exec(`SELECT 1 FROM meta WHERE k='main'`).toArray().length > 0;
  }

  private async init(request: Request): Promise<SpacePublic> {
    if (this.exists()) throw new Error("409 space already exists");
    const body = (await request.json()) as { name: string; code: string; host: Attachment };
    const sql = this.ctx.storage.sql;
    sql.exec(
      `INSERT INTO meta (k, name, code, host_member_id, created_at) VALUES ('main', ?, ?, ?, ?)`,
      body.name, body.code, body.host.memberId, Date.now(),
    );
    this.upsertMember(body.host);
    return this.publicInfo();
  }

  private async join(request: Request): Promise<{ space: SpacePublic }> {
    if (!this.exists()) throw new Error("404 no such space");
    const member = (await request.json()) as Attachment;
    const count = this.memberCount();
    const already = this.ctx.storage.sql
      .exec(`SELECT 1 FROM members WHERE member_id = ?`, member.memberId).toArray().length > 0;
    if (!already && count >= SPACE_QUOTAS.maxMembers) throw new Error("403 space is full");
    this.upsertMember(member);
    return { space: this.publicInfo() };
  }

  private upsertMember(m: Attachment): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO members (member_id, display_name, role, avatar_seed, joined_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(member_id) DO UPDATE SET display_name=excluded.display_name`,
      m.memberId, m.displayName, m.role, m.avatarSeed, m.joinedAt || Date.now(),
    );
  }

  // ----------------------------------------------------------------- WebSocket
  private handleUpgrade(request: Request): Response {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    if (!this.exists()) return new Response("no such space", { status: 404 });

    const att: Attachment = {
      memberId: request.headers.get("X-Member-Id") ?? "anon",
      role: (request.headers.get("X-Role") as Role) ?? "guest",
      displayName: request.headers.get("X-Display-Name") ?? "Guest",
      avatarSeed: request.headers.get("X-Avatar-Seed") ?? "seed",
      joinedAt: Date.now(),
    };

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [att.memberId]);
    server.serializeAttachment(att);
    this.upsertMember(att);

    // Initial snapshot to the joiner.
    this.send(server, {
      type: "hello",
      you: this.toMember(att),
      space: this.publicInfo(),
      members: this.presentMembers(),
      wall: this.wallSnapshot(),
    });
    // Tell everyone else someone arrived.
    this.broadcast({ type: "member_join", member: this.toMember(att) }, server);
    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    if (typeof raw !== "string") return;
    if (this.wsRateLimited(ws)) {
      this.send(ws, { type: "rate_limited", scope: "ws" });
      return;
    }
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    const att = ws.deserializeAttachment() as Attachment | null;

    switch (msg.type) {
      case "clock_ping":
        this.send(ws, { type: "clock", serverNow: Date.now(), echo: msg.t0 });
        break;
      case "ping":
        break;
      case "trigger_moment":
        if (att?.role === "host") void this.scheduleMoment(att.memberId);
        else this.send(ws, { type: "error", message: "Only the host can trigger a Moment." });
        break;
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.onLeave(ws);
  }
  webSocketError(ws: WebSocket): void {
    this.onLeave(ws);
  }

  private onLeave(ws: WebSocket): void {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    const stillHere = this.ctx
      .getWebSockets()
      .some((s) => s !== ws && (s.deserializeAttachment() as Attachment | null)?.memberId === att.memberId);
    if (!stillHere) this.broadcast({ type: "member_leave", memberId: att.memberId }, ws);
    this.broadcastPresence(ws);
  }

  private wsRateLimited(ws: WebSocket): boolean {
    const now = Date.now();
    const { limit, windowMs } = RATE_LIMITS.wsMessage;
    let h = this.wsHits.get(ws);
    if (!h || now - h.start > windowMs) h = { count: 0, start: now };
    h.count += 1;
    this.wsHits.set(ws, h);
    return h.count > limit;
  }

  // ------------------------------------------------------------------- media
  private async addMedia(request: Request): Promise<{ media: MediaMeta }> {
    const kind = (request.headers.get("X-Media-Kind") as MediaKind) ?? "wall";
    const momentId = request.headers.get("X-Moment-Id");
    const memberId = request.headers.get("X-Member-Id") ?? "anon";
    const displayName = request.headers.get("X-Display-Name") ?? "Guest";
    const contentType = request.headers.get("Content-Type") ?? "image/webp";
    const width = Number(request.headers.get("X-Width") ?? "0");
    const height = Number(request.headers.get("X-Height") ?? "0");

    // Quota checks.
    const stats = this.mediaStats();
    if (stats.count >= SPACE_QUOTAS.maxMediaItems) throw new Error("429 space media limit reached");
    if (stats.bytes >= SPACE_QUOTAS.maxMediaBytes) throw new Error("429 space storage limit reached");

    const buf = await request.arrayBuffer();
    if (buf.byteLength === 0) throw new Error("400 empty body");
    if (buf.byteLength > MAX_MEDIA_BYTES) throw new Error("413 media too large");

    const id = nanoid(16);
    const createdAt = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO media (id, kind, moment_id, member_id, display_name, content_type, width, height, created_at, bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, kind, momentId, memberId, displayName, contentType, width, height, createdAt, new Uint8Array(buf),
    );

    const media: MediaMeta = {
      id, kind, momentId: momentId ?? undefined, memberId, displayName,
      contentType, width, height, createdAt,
    };
    this.broadcast({ type: "media_added", media });
    return { media };
  }

  private getMediaBytes(id: string): Response {
    const row = this.ctx.storage.sql
      .exec<{ bytes: ArrayBuffer; content_type: string }>(
        `SELECT bytes, content_type FROM media WHERE id = ?`, id,
      ).toArray()[0];
    if (!row) return new Response("not found", { status: 404 });
    return new Response(row.bytes, {
      headers: {
        "Content-Type": row.content_type,
        // Immutable, unguessable id → safe to cache hard at the edge & in the browser.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // ----------------------------------------------------------------- moments
  private async triggerMoment(request: Request): Promise<{ momentId: string; captureAtServer: number; serverNow: number }> {
    const memberId = request.headers.get("X-Member-Id") ?? "anon";
    return this.scheduleMoment(memberId);
  }

  private async scheduleMoment(triggeredBy: string): Promise<{ momentId: string; captureAtServer: number; serverNow: number }> {
    const now = Date.now();
    const momentId = nanoid(12);
    const captureAt = now + MOMENT_COUNTDOWN_MS;
    const finalizeAt = captureAt + MOMENT_COLLECT_WINDOW_MS;
    this.ctx.storage.sql.exec(
      `INSERT INTO moments (moment_id, created_at, triggered_by, capture_at, finalize_at, status)
       VALUES (?, ?, ?, ?, ?, 'scheduled')`,
      momentId, now, triggeredBy, captureAt, finalizeAt,
    );
    const triggeredName = this.ctx.storage.sql
      .exec<{ display_name: string }>(`SELECT display_name FROM members WHERE member_id = ?`, triggeredBy)
      .toArray()[0]?.display_name ?? "Someone";

    this.broadcast({
      type: "moment_scheduled",
      momentId, captureAtServer: captureAt, serverNow: now, triggeredBy: triggeredName,
    });

    // Ensure an alarm is set to finalize this (and any earlier pending) moment.
    const current = await this.ctx.storage.getAlarm();
    if (current === null || finalizeAt < current) await this.ctx.storage.setAlarm(finalizeAt);

    return { momentId, captureAtServer: captureAt, serverNow: now };
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const due = this.ctx.storage.sql
      .exec<{ moment_id: string }>(`SELECT moment_id FROM moments WHERE status='scheduled' AND finalize_at <= ?`, now)
      .toArray();
    for (const { moment_id } of due) {
      this.ctx.storage.sql.exec(`UPDATE moments SET status='complete' WHERE moment_id = ?`, moment_id);
      const media = this.wallSnapshot().filter((m) => m.momentId === moment_id);
      this.broadcast({ type: "moment_complete", momentId: moment_id, media });
    }
    const next = this.ctx.storage.sql
      .exec<{ finalize_at: number }>(`SELECT finalize_at FROM moments WHERE status='scheduled' ORDER BY finalize_at ASC LIMIT 1`)
      .toArray()[0];
    if (next) await this.ctx.storage.setAlarm(next.finalize_at);
  }

  // ------------------------------------------------------------- projections
  private toMember(a: Attachment): Member {
    return { memberId: a.memberId, displayName: a.displayName, role: a.role, avatarSeed: a.avatarSeed, joinedAt: a.joinedAt };
  }

  private presentMembers(): Member[] {
    const seen = new Map<string, Member>();
    for (const s of this.ctx.getWebSockets()) {
      const a = s.deserializeAttachment() as Attachment | null;
      if (a && !seen.has(a.memberId)) seen.set(a.memberId, this.toMember(a));
    }
    return [...seen.values()];
  }

  private wallSnapshot(): MediaMeta[] {
    return this.ctx.storage.sql
      .exec<MediaRow>(`SELECT id, kind, moment_id, member_id, display_name, content_type, width, height, created_at FROM media ORDER BY created_at ASC`)
      .toArray()
      .map((r) => ({
        id: r.id, kind: r.kind, momentId: r.moment_id ?? undefined, memberId: r.member_id,
        displayName: r.display_name, contentType: r.content_type, width: r.width, height: r.height, createdAt: r.created_at,
      }));
  }

  private memberCount(): number {
    return this.ctx.storage.sql.exec<{ n: number }>(`SELECT COUNT(*) n FROM members`).toArray()[0]?.n ?? 0;
  }

  private mediaStats(): { count: number; bytes: number } {
    const row = this.ctx.storage.sql
      .exec<{ n: number; b: number | null }>(`SELECT COUNT(*) n, SUM(LENGTH(bytes)) b FROM media`).toArray()[0];
    return { count: row?.n ?? 0, bytes: row?.b ?? 0 };
  }

  private publicInfo(): SpacePublic {
    const m = this.ctx.storage.sql
      .exec<{ name: string; code: string; created_at: number }>(`SELECT name, code, created_at FROM meta WHERE k='main'`)
      .toArray()[0];
    return {
      code: m?.code ?? "",
      name: m?.name ?? "",
      memberCount: this.memberCount(),
      mediaCount: this.mediaStats().count,
      createdAt: m?.created_at ?? 0,
    };
  }

  private publicInfoResponse(): Response {
    if (!this.exists()) return this.json({ error: "404 no such space" }, 404);
    return this.json(this.publicInfo());
  }

  // --------------------------------------------------------------- transport
  private send(ws: WebSocket, msg: ServerMessage): void {
    try { ws.send(JSON.stringify(msg)); } catch { /* socket gone */ }
  }

  private broadcast(msg: ServerMessage, except?: WebSocket): void {
    const data = JSON.stringify(msg);
    for (const s of this.ctx.getWebSockets()) {
      if (s === except) continue;
      try { s.send(data); } catch { /* ignore */ }
    }
  }

  private broadcastPresence(except?: WebSocket): void {
    const members = this.presentMembers();
    const data = JSON.stringify({ type: "presence", members } satisfies ServerMessage);
    for (const s of this.ctx.getWebSockets()) {
      if (s === except) continue;
      try { s.send(data); } catch { /* ignore */ }
    }
  }

  private json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  }
}
