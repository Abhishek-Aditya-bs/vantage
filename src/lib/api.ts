/**
 * Typed fetch client for the Vantage Worker API.
 *
 * - Capability tokens are stored in sessionStorage keyed by space code so a tab
 *   refresh keeps you in your space without leaking the token to other origins.
 * - Every method throws a typed `ApiError` on non-2xx so callers can branch on
 *   `.status` / `.code`.
 */
import type {
  AuthResult,
  CreateSpaceBody,
  JoinSpaceBody,
  MediaKind,
  MediaMeta,
  MomentResult,
  SpacePublic,
} from "@shared/protocol";

/* ------------------------------------------------------------- token store */

const tokenKey = (code: string) => `vantage:token:${code.toUpperCase()}`;

export function getToken(code: string): string | null {
  try {
    return sessionStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}

export function setToken(code: string, token: string): void {
  try {
    sessionStorage.setItem(tokenKey(code), token);
  } catch {
    /* storage may be unavailable (private mode) — non-fatal */
  }
}

export function clearToken(code: string): void {
  try {
    sessionStorage.removeItem(tokenKey(code));
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------------- errors */

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let message = res.statusText || "Request failed";
  let code: string | undefined;
  try {
    const body = (await res.json()) as { error?: string; code?: string };
    if (body?.error) message = body.error;
    if (body?.code) code = body.code;
  } catch {
    /* body was not JSON */
  }
  return new ApiError(res.status, message, code);
}

/* ------------------------------------------------------------- low-level */

interface RequestOptions {
  method?: string;
  /** space code whose token should be attached as a Bearer */
  authCode?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.authCode) {
    const token = getToken(opts.authCode);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ?? null,
    signal: opts.signal,
  });
  if (!res.ok) throw await parseError(res);
  // 204 / empty bodies are tolerated by callers expecting `void`.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function postJson<T>(
  path: string,
  json: unknown,
  authCode?: string,
): Promise<T> {
  return request<T>(path, {
    method: "POST",
    authCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
}

/* --------------------------------------------------------------- endpoints */

export const api = {
  health(): Promise<{ ok: boolean }> {
    return request("/api/health");
  },

  /** Create a space; persists the host token under the returned space code. */
  async createSpace(body: CreateSpaceBody): Promise<AuthResult> {
    const result = await postJson<AuthResult>("/api/spaces", body);
    setToken(result.space.code, result.token);
    return result;
  },

  /** Public preview for the Join screen (no auth). */
  getSpace(code: string, signal?: AbortSignal): Promise<SpacePublic> {
    return request(`/api/spaces/${encodeURIComponent(code)}`, { signal });
  },

  /** Join a space; persists the guest token. */
  async joinSpace(code: string, body: JoinSpaceBody): Promise<AuthResult> {
    const result = await postJson<AuthResult>(
      `/api/spaces/${encodeURIComponent(code)}/join`,
      body,
    );
    setToken(result.space.code, result.token);
    return result;
  },

  /** Full media backlog (used as a fallback when the socket is cold). */
  getMedia(code: string, signal?: AbortSignal): Promise<{ media: MediaMeta[] }> {
    return request(`/api/spaces/${encodeURIComponent(code)}/media`, {
      authCode: code,
      signal,
    });
  },

  /** Upload a raw image blob. Server derives metadata from the X-* headers. */
  uploadMedia(
    code: string,
    blob: Blob,
    meta: {
      kind: MediaKind;
      width: number;
      height: number;
      momentId?: string;
    },
  ): Promise<UploadResult> {
    const headers: Record<string, string> = {
      "Content-Type": blob.type || "image/webp",
      "X-Media-Kind": meta.kind,
      "X-Width": String(meta.width),
      "X-Height": String(meta.height),
    };
    if (meta.momentId) headers["X-Moment-Id"] = meta.momentId;
    return request(`/api/spaces/${encodeURIComponent(code)}/media`, {
      method: "POST",
      authCode: code,
      headers,
      body: blob,
    });
  },

  /** Host-only: schedule a synchronized Moment. */
  triggerMoment(code: string): Promise<MomentResult> {
    return postJson<MomentResult>(
      `/api/spaces/${encodeURIComponent(code)}/moment`,
      {},
      code,
    );
  },

  /** Refresh the capability token before it expires. */
  async refreshToken(code: string): Promise<string> {
    const result = await postJson<{ token: string }>(
      "/api/token/refresh",
      {},
      code,
    );
    setToken(code, result.token);
    return result.token;
  },

  /** Public image URL — usable directly as an <img src> (no auth header). */
  mediaUrl(code: string, id: string): string {
    return `/api/m/${encodeURIComponent(code)}/${encodeURIComponent(id)}`;
  },
};

/* re-export for convenience at call sites */
import type { UploadResult } from "@shared/protocol";
export type { UploadResult };
