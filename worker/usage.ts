/**
 * Cloudflare free-tier limits reference + analytics fetch for the admin
 * usage dashboard. All limits were verified against official documentation
 * on 2026-06-06.
 *
 * Sources:
 *   Workers limits:        https://developers.cloudflare.com/workers/platform/limits/
 *   Workers pricing:       https://developers.cloudflare.com/workers/platform/pricing/
 *   DO pricing:            https://developers.cloudflare.com/durable-objects/platform/pricing/
 *   DO limits:             https://developers.cloudflare.com/durable-objects/platform/limits/
 *   D1 limits:             https://developers.cloudflare.com/d1/platform/limits/
 *   KV limits:             https://developers.cloudflare.com/kv/platform/limits/
 *   Workers AI pricing:    https://developers.cloudflare.com/workers-ai/platform/pricing/
 */

export const FREE_TIER_AS_OF = "2026-06-06";

export type Period = "day" | "month" | "total";
export type ServiceSource = "measured" | "analytics" | "unconfigured";

export interface FreeTierService {
  /** Stable machine key used in the API response. */
  key: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /**
   * The free-tier hard limit.  null means "no hard cap" — show as informational
   * only (e.g. Workers bandwidth).
   */
  limit: number | null;
  /** Unit string shown in the UI, e.g. "req", "GB-s", "rows", "GB", "neurons". */
  unit: string;
  /**
   * Resets every day, month, or is a perpetual total (storage).
   * 'total' means the limit is on the accumulated amount at rest.
   */
  period: Period;
  /** Official doc URL for auditing. */
  docUrl: string;
  /**
   * Optional explanatory note (e.g. "free on Free plan; SQLite-backed only").
   * Also used by the API to surface "set CF_API_TOKEN to see live counts" hints.
   */
  note?: string;
}

/**
 * Canonical list of Cloudflare free-tier limits relevant to this app.
 *
 * Numbers as of FREE_TIER_AS_OF (2026-06-06):
 *
 *   Workers requests:      100,000 / day
 *   Workers CPU time:      10 ms / invocation (no hard daily total)
 *   DO requests:           100,000 / day
 *   DO compute:            13,000 GB-s / day
 *   DO SQLite rows read:   5,000,000 / day  (same rates as D1)
 *   DO SQLite rows written:100,000 / day
 *   DO storage (total):    5 GB across all objects in the account
 *   D1 rows read:          5,000,000 / day
 *   D1 rows written:       100,000 / day
 *   D1 storage (total):    5 GB
 *   KV reads:              100,000 / day
 *   KV writes:             1,000 / day
 *   KV storage (total):    1 GB
 *   Workers AI neurons:    10,000 / day
 */
export const FREE_TIER: readonly FreeTierService[] = [
  // ---- Durable Objects (the primary runtime substrate for this app) ---------
  {
    key: "do_requests",
    label: "DO requests",
    limit: 100_000,
    unit: "req",
    period: "day",
    docUrl: "https://developers.cloudflare.com/durable-objects/platform/pricing/",
    note: "HTTP requests + WebSocket messages (20:1 ratio) to Durable Objects",
  },
  {
    key: "do_duration",
    label: "DO compute",
    limit: 13_000,
    unit: "GB-s",
    period: "day",
    docUrl: "https://developers.cloudflare.com/durable-objects/platform/pricing/",
    note: "Billed at 128 MB allocation per object regardless of actual use",
  },
  {
    key: "do_storage",
    label: "DO storage",
    limit: 5,
    unit: "GB",
    period: "total",
    docUrl: "https://developers.cloudflare.com/durable-objects/platform/pricing/",
    note: "Total SQLite storage across all Durable Objects in the account (5 GB free)",
  },
  {
    key: "do_rows_read",
    label: "DO rows read",
    limit: 5_000_000,
    unit: "rows",
    period: "day",
    docUrl: "https://developers.cloudflare.com/durable-objects/platform/pricing/",
    note: "SQLite-backed DOs only; same rates as D1",
  },
  {
    key: "do_rows_written",
    label: "DO rows written",
    limit: 100_000,
    unit: "rows",
    period: "day",
    docUrl: "https://developers.cloudflare.com/durable-objects/platform/pricing/",
    note: "SQLite-backed DOs only; same rates as D1",
  },

  // ---- D1 (the spaces registry / metadata database) ------------------------
  {
    key: "d1_rows_read",
    label: "D1 rows read",
    limit: 5_000_000,
    unit: "rows",
    period: "day",
    docUrl: "https://developers.cloudflare.com/d1/platform/limits/",
  },
  {
    key: "d1_rows_written",
    label: "D1 rows written",
    limit: 100_000,
    unit: "rows",
    period: "day",
    docUrl: "https://developers.cloudflare.com/d1/platform/limits/",
  },
  {
    key: "d1_storage",
    label: "D1 storage",
    limit: 5,
    unit: "GB",
    period: "total",
    docUrl: "https://developers.cloudflare.com/d1/platform/limits/",
  },

  // ---- Workers (the API gateway / HTTP layer) ------------------------------
  {
    key: "workers_requests",
    label: "Worker requests",
    limit: 100_000,
    unit: "req",
    period: "day",
    docUrl: "https://developers.cloudflare.com/workers/platform/limits/",
    note: "Free limit; resets daily at 00:00 UTC",
  },

  // ---- KV (rate-limiter DO uses KV-like patterns; included for completeness)
  {
    key: "kv_reads",
    label: "KV reads",
    limit: 100_000,
    unit: "reads",
    period: "day",
    docUrl: "https://developers.cloudflare.com/kv/platform/limits/",
  },
  {
    key: "kv_writes",
    label: "KV writes",
    limit: 1_000,
    unit: "writes",
    period: "day",
    docUrl: "https://developers.cloudflare.com/kv/platform/limits/",
  },
  {
    key: "kv_storage",
    label: "KV storage",
    limit: 1,
    unit: "GB",
    period: "total",
    docUrl: "https://developers.cloudflare.com/kv/platform/limits/",
  },

  // ---- Workers AI (optional image moderation path) -------------------------
  {
    key: "ai_neurons",
    label: "AI neurons",
    limit: 10_000,
    unit: "neurons",
    period: "day",
    docUrl: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
    note: "Used only when MODERATION_MODE=on; resets daily at 00:00 UTC",
  },
] as const;

// ---------------------------------------------------------------------------
// Response shape — also exported so src/lib/adminApi.ts can import the type.
// ---------------------------------------------------------------------------

export interface UsageServiceResult {
  key: string;
  label: string;
  limit: number | null;
  unit: string;
  period: Period;
  /** Raw measured/fetched value. null = unknown / not configured. */
  used: number | null;
  /** 0–100 percentage of limit consumed.  null when limit is null or used is null. */
  pct: number | null;
  source: ServiceSource;
  note?: string;
  docUrl: string;
}

export interface UsageResponse {
  /** ISO timestamp when the snapshot was generated. */
  generatedAt: string;
  /** Date the free-tier numbers in this payload were last verified. */
  asOf: string;
  services: UsageServiceResult[];
}

// ---------------------------------------------------------------------------
// Helpers to build individual service results
// ---------------------------------------------------------------------------

function measured(
  svc: FreeTierService,
  used: number | null,
): UsageServiceResult {
  const pct =
    used !== null && svc.limit !== null
      ? Math.min(100, Math.round((used / svc.limit) * 100))
      : null;
  return {
    key: svc.key,
    label: svc.label,
    limit: svc.limit,
    unit: svc.unit,
    period: svc.period,
    used,
    pct,
    source: used !== null ? "measured" : "unconfigured",
    note: svc.note,
    docUrl: svc.docUrl,
  };
}

function analytics(
  svc: FreeTierService,
  used: number | null,
  note?: string,
): UsageServiceResult {
  const pct =
    used !== null && svc.limit !== null
      ? Math.min(100, Math.round((used / svc.limit) * 100))
      : null;
  return {
    key: svc.key,
    label: svc.label,
    limit: svc.limit,
    unit: svc.unit,
    period: svc.period,
    used,
    pct,
    source: used !== null ? "analytics" : "unconfigured",
    note: note ?? svc.note,
    docUrl: svc.docUrl,
  };
}

function svcByKey(key: string): FreeTierService {
  const s = FREE_TIER.find((s) => s.key === key);
  if (!s) throw new Error(`Unknown service key: ${key}`);
  return s;
}

// ---------------------------------------------------------------------------
// Cloudflare GraphQL Analytics API query
// ---------------------------------------------------------------------------

interface WorkersAnalyticsRow {
  sum: { requests: number };
}
interface GqlResponse<T> {
  data?: {
    viewer?: {
      accounts?: Array<{
        [dataset: string]: T[];
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Query the Cloudflare GraphQL Analytics API for the last 24 h of Workers
 * invocations for the given account.  Returns null on any error.
 */
async function fetchWorkersRequests(
  apiToken: string,
  accountId: string,
): Promise<number | null> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/\.\d+Z$/, "Z");

  const query = `{
    viewer {
      accounts(filter: { accountTag: "${accountId}" }) {
        workersInvocationsAdaptive(
          limit: 1
          filter: { datetime_geq: "${fmt(yesterday)}", datetime_leq: "${fmt(now)}" }
        ) {
          sum { requests }
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as GqlResponse<WorkersAnalyticsRow>;
    if (json.errors?.length) return null;
    const rows = json.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
    if (!rows || rows.length === 0) return 0;
    return rows.reduce((acc, r) => acc + (r.sum?.requests ?? 0), 0);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main: build the full UsageResponse
// ---------------------------------------------------------------------------

/**
 * Assemble the usage snapshot.
 *
 * @param totalBytes   Sum of DO SQLite bytes across all spaces (from /stats).
 * @param spaceCount   Number of rows in the D1 spaces table.
 * @param totalMedia   Total media items across all spaces.
 * @param totalMembers Total distinct members across all spaces.
 * @param cfApiToken   Optional; from env.CF_API_TOKEN.
 * @param cfAccountId  Optional; from env.CF_ACCOUNT_ID.
 */
export async function buildUsageResponse(
  totalBytes: number,
  spaceCount: number,
  _totalMedia: number,
  _totalMembers: number,
  cfApiToken?: string,
  cfAccountId?: string,
): Promise<UsageResponse> {
  const UNCONFIGURED_NOTE =
    "set CF_API_TOKEN + CF_ACCOUNT_ID to see live request counts";

  // -- Measured: values we can derive from our own data ----------------------

  // DO storage: convert bytes → GB (total across all spaces' DOs)
  const doStorageGb = totalBytes / (1024 * 1024 * 1024);

  // D1 "storage" proxy: we only know the row count, not bytes — approximate
  // with the space count as the key D1 write indicator.
  // For "rows read" we can't measure without hooking every query; report null.
  const measuredServices: UsageServiceResult[] = [
    measured(svcByKey("do_storage"), doStorageGb),
    // DO row-level stats are not observable from the outside; report unconfigured.
    measured(svcByKey("do_requests"), null),
    measured(svcByKey("do_duration"), null),
    measured(svcByKey("do_rows_read"), null),
    measured(svcByKey("do_rows_written"), null),
    // D1: we know the space count (rows written ≈ spaces created); not a daily rate.
    // Show D1 storage as unknown (we don't have byte-size from D1), rows as unknown.
    measured(svcByKey("d1_rows_read"), null),
    measured(svcByKey("d1_rows_written"), spaceCount), // spaces rows ≈ D1 writes (informational)
    measured(svcByKey("d1_storage"), null),
    // KV: not directly observable.
    measured(svcByKey("kv_reads"), null),
    measured(svcByKey("kv_writes"), null),
    measured(svcByKey("kv_storage"), null),
    // Workers AI: not observable without Cloudflare API.
    measured(svcByKey("ai_neurons"), null),
  ];

  // -- Analytics: pull live Workers request count from CF GraphQL (optional) --

  let workersRequestsUsed: number | null = null;
  if (cfApiToken && cfAccountId) {
    workersRequestsUsed = await fetchWorkersRequests(cfApiToken, cfAccountId);
  }

  const workersSvc = svcByKey("workers_requests");
  const workersResult = analytics(
    workersSvc,
    workersRequestsUsed,
    workersRequestsUsed === null && cfApiToken && cfAccountId
      ? "Analytics API returned no data for this account"
      : !cfApiToken || !cfAccountId
        ? UNCONFIGURED_NOTE
        : undefined,
  );

  // Build the final ordered list — DO metrics first (they're the primary
  // substrate), then Workers (gateway), D1 (registry), KV, AI.
  const byKey = new Map(measuredServices.map((s) => [s.key, s]));

  const orderedKeys = [
    "do_storage",
    "do_requests",
    "do_duration",
    "do_rows_read",
    "do_rows_written",
    "d1_storage",
    "d1_rows_read",
    "d1_rows_written",
    "kv_storage",
    "kv_reads",
    "kv_writes",
    "ai_neurons",
  ];

  const services: UsageServiceResult[] = [
    // Workers first (has live analytics data when configured)
    workersResult,
    ...orderedKeys.map((k) => byKey.get(k)!),
  ];

  return {
    generatedAt: new Date().toISOString(),
    asOf: FREE_TIER_AS_OF,
    services,
  };
}
