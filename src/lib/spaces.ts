/**
 * Recent-spaces registry (localStorage) — lets you RE-ENTER spaces you created or
 * joined, even after closing the tab. Unlike the per-tab session token, this
 * persists {code, name, role, joinUrl, token}. The token is short-lived
 * (host 6h / guest 4h) and scoped to one space, so persisting it just buys you a
 * "rejoin" button until it naturally expires (after which you re-join via link).
 */
export interface RecentSpace {
  code: string;
  name: string;
  role: "host" | "guest";
  joinUrl: string;
  token: string;
  lastSeenAt: number;
}

const KEY = "vantage:spaces";
const MAX = 12;

function read(): RecentSpace[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecentSpace[]) : [];
  } catch {
    return [];
  }
}

function write(list: RecentSpace[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable (private mode) — non-fatal */
  }
}

/** Most-recently-seen first. */
export function listSpaces(): RecentSpace[] {
  return read().sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export function getSpace(code: string): RecentSpace | undefined {
  const c = code.toUpperCase();
  return read().find((x) => x.code.toUpperCase() === c);
}

/** Upsert a space (used on create / join). Moves it to the top. */
export function recordSpace(s: Omit<RecentSpace, "lastSeenAt">): void {
  const code = s.code.toUpperCase();
  const next = read().filter((x) => x.code.toUpperCase() !== code);
  next.unshift({ ...s, code, lastSeenAt: Date.now() });
  write(next);
}

/** Bump lastSeen + optionally patch fields (e.g. the latest space name). */
export function touchSpace(code: string, patch: Partial<RecentSpace> = {}): void {
  const c = code.toUpperCase();
  const list = read();
  const found = list.find((x) => x.code.toUpperCase() === c);
  if (!found) return;
  Object.assign(found, patch, { lastSeenAt: Date.now() });
  write(list);
}

/** Remove a space from the list ("leave & forget"). */
export function forgetSpace(code: string): void {
  const c = code.toUpperCase();
  write(read().filter((x) => x.code.toUpperCase() !== c));
}
