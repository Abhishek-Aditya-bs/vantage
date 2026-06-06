/**
 * Admin dashboard API client. The admin session token lives in sessionStorage
 * (per-tab) and is attached as a Bearer to every admin call.
 */
const KEY = "vantage:admin";

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function setAdminToken(t: string): void {
  try {
    sessionStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
}
export function clearAdminToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export interface AdminSpace {
  code: string;
  name: string;
  status: string;
  createdAt: number;
  lastActiveAt: number;
  members: number;
  live: number;
  photos: number;
  bytes: number;
}

export interface AdminData {
  spaces: AdminSpace[];
  totals: { spaces: number; photos: number; live: number; bytes: number; members: number };
}

export class AdminError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (auth) {
    const t = getAdminToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const b = (await res.json()) as { error?: string };
      if (b.error) msg = b.error;
    } catch {
      /* non-json */
    }
    throw new AdminError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const adminApi = {
  requestCode(email: string): Promise<{ ok: boolean; emailSent: boolean }> {
    return call(
      "/api/admin/login/request",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) },
      false,
    );
  },
  async verify(email: string, code: string): Promise<void> {
    const { token } = await call<{ token: string }>(
      "/api/admin/login/verify",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) },
      false,
    );
    setAdminToken(token);
  },
  spaces(): Promise<AdminData> {
    return call<AdminData>("/api/admin/spaces");
  },
  deleteSpace(code: string): Promise<{ ok: boolean }> {
    return call(`/api/admin/spaces/${encodeURIComponent(code)}`, { method: "DELETE" });
  },
  wipe(): Promise<{ spaces: number; purged: number }> {
    return call("/api/admin/wipe", { method: "POST" });
  },
};
