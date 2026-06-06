/**
 * Admin — a single-admin dashboard gated by email OTP (allowlisted to one
 * address) with a master-passcode fallback. Lists every space with live/photo/
 * size stats and lets the admin delete one or wipe everything.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { RefreshCw, Trash2, LogOut, ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Mascot } from "@/components/brand/Mascot";
import { UsageBar } from "@/components/admin/UsageBar";
import {
  adminApi,
  getAdminToken,
  clearAdminToken,
  AdminError,
  type AdminData,
  type UsageData,
} from "@/lib/adminApi";

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}
function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function Admin() {
  const { toast } = useToast();
  const [authed, setAuthed] = useState(() => !!getAdminToken());

  // login
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);

  // dashboard — spaces
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);

  // dashboard — usage
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const usageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminApi.spaces());
    } catch (e) {
      if (e instanceof AdminError && e.status === 401) {
        clearAdminToken();
        setAuthed(false);
      } else {
        toast({ title: "Couldn't load", description: (e as Error).message, tone: "error" });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadUsage = useCallback(async () => {
    if (document.hidden) return; // skip while tab is not visible
    setUsageLoading(true);
    try {
      setUsage(await adminApi.getUsage());
    } catch (e) {
      if (e instanceof AdminError && e.status === 401) {
        clearAdminToken();
        setAuthed(false);
      }
      // Non-fatal: keep stale data; don't show a noisy toast for every auto-refresh
    } finally {
      setUsageLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 60 s; pause when tab is hidden.
  useEffect(() => {
    if (!authed) return;
    void loadUsage();

    const INTERVAL_MS = 60_000;
    usageIntervalRef.current = setInterval(() => {
      void loadUsage();
    }, INTERVAL_MS);

    const onVisibilityChange = () => {
      if (!document.hidden) void loadUsage();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (usageIntervalRef.current !== null) {
        clearInterval(usageIntervalRef.current);
        usageIntervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authed, loadUsage]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await adminApi.requestCode(email.trim());
      setEmailSent(r.emailSent);
      setStep("code");
      toast({ title: r.emailSent ? "Code sent to your email" : "Enter your admin passcode", tone: "success" });
    } catch (e) {
      toast({ title: "Request failed", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await adminApi.verify(email.trim(), code.trim());
      setAuthed(true);
    } catch (e) {
      toast({ title: "Sign-in failed", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function del(c: string, name: string) {
    if (!window.confirm(`Delete "${name}" (${c})? This permanently wipes its photos.`)) return;
    try {
      await adminApi.deleteSpace(c);
      toast({ title: "Space deleted", tone: "success" });
      load();
    } catch (e) {
      toast({ title: "Delete failed", description: (e as Error).message, tone: "error" });
    }
  }

  async function wipe() {
    if (!window.confirm("Wipe ALL spaces and photos? This cannot be undone.")) return;
    try {
      const r = await adminApi.wipe();
      toast({ title: `Wiped ${r.purged} space${r.purged === 1 ? "" : "s"}`, tone: "success" });
      load();
    } catch (e) {
      toast({ title: "Wipe failed", description: (e as Error).message, tone: "error" });
    }
  }

  function logout() {
    clearAdminToken();
    setAuthed(false);
    setStep("email");
    setCode("");
  }

  /* ------------------------------------------------------------- login ---- */
  if (!authed) {
    return (
      <div className="min-h-dvh bg-background">
        <AppHeader />
        <main id="main" className="mx-auto flex w-full max-w-md flex-col px-5 py-16">
          <div className="rounded-xl border border-border bg-card p-7 sm:p-9">
            <div className="flex items-center gap-3">
              <Mascot size={32} />
              <div>
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted-foreground">
                  Vantage · admin
                </p>
                <h1 className="font-display text-xl font-bold tracking-tight">Sign in</h1>
              </div>
            </div>

            {step === "email" ? (
              <form onSubmit={requestCode} className="mt-7 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Admin email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoComplete="off"
                    required
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={busy || !email.trim()}>
                  {busy ? "Sending…" : "Send sign-in code"}
                </Button>
                <p className="font-mono text-[0.7rem] text-muted-foreground">
                  A one-time code is emailed to the allowlisted admin. If email isn&rsquo;t configured, use your
                  master passcode on the next step.
                </p>
              </form>
            ) : (
              <form onSubmit={verify} className="mt-7 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">{emailSent ? "Code from your email" : "Code / passcode"}</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={emailSent ? "123456" : "code or passcode"}
                    autoFocus
                    required
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={busy || !code.trim()}>
                  {busy ? "Verifying…" : "Verify & enter"}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                >
                  ← back
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    );
  }

  /* ----------------------------------------------------------- dashboard -- */
  const t = data?.totals;
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader>
        <Button variant="outline" size="sm" onClick={logout} className="font-mono text-xs">
          <LogOut /> <span className="hidden sm:inline">Sign out</span>
        </Button>
      </AppHeader>

      <main id="main" className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.26em] text-muted-foreground">
              Vantage · admin
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="font-mono text-xs">
              <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={wipe} className="font-mono text-xs">
              <ShieldAlert /> Wipe all
            </Button>
          </div>
        </div>

        {/* totals */}
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          {[
            ["spaces", t?.spaces ?? 0],
            ["live now", t?.live ?? 0],
            ["photos", t?.photos ?? 0],
            ["storage", fmtBytes(t?.bytes ?? 0)],
          ].map(([k, v]) => (
            <div key={k} className="bg-background p-5">
              <dt className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{k}</dt>
              <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>

        {/* ── Free-tier usage ─────────────────────────────────────────── */}
        <div className="mt-8 rounded-lg border border-border bg-card">
          {/* section header */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="flex items-center gap-3">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                Free-tier usage
              </p>
              {usage && (
                <span className="font-mono text-[0.6rem] text-muted-foreground/50">
                  limits as of {usage.asOf}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {usage && (
                <span className="font-mono text-[0.6rem] text-muted-foreground/50 hidden sm:block">
                  live {new Date(usage.generatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
              <button
                type="button"
                onClick={() => void loadUsage()}
                disabled={usageLoading}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
                aria-label="Refresh usage data"
              >
                <RefreshCw className={`size-3 ${usageLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* service rows */}
          <div className="divide-y divide-border px-5">
            {!usage && usageLoading && (
              <p className="py-8 text-center font-mono text-sm text-muted-foreground">loading…</p>
            )}
            {usage?.services.map((svc) => (
              <UsageBar key={svc.key} service={svc} />
            ))}
            {usage && (
              <p className="py-2 font-mono text-[0.58rem] text-muted-foreground/40 leading-relaxed">
                auto-refreshes every 60 s · pauses when tab is hidden ·{" "}
                <a
                  href="https://developers.cloudflare.com/workers/platform/pricing/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-muted-foreground underline underline-offset-2"
                >
                  Cloudflare pricing docs
                </a>
              </p>
            )}
          </div>
        </div>

        {/* table */}
        <div className="mt-8 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-border font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Space</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-3 py-3 text-right font-medium">Live</th>
                <th className="px-3 py-3 text-right font-medium">Members</th>
                <th className="px-3 py-3 text-right font-medium">Photos</th>
                <th className="px-3 py-3 text-right font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data?.spaces.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center font-mono text-sm text-muted-foreground">
                    no spaces — blank canvas
                  </td>
                </tr>
              )}
              {data?.spaces.map((s) => (
                <tr key={s.code} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">{s.name}</span>
                    {s.status !== "active" && (
                      <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                        {s.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.code}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {s.live > 0 ? <span className="text-live">{s.live}</span> : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.members}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.photos}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmtBytes(s.bytes)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fmtDate(s.lastActiveAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => del(s.code, s.name)}
                      aria-label={`Delete ${s.name}`}
                      className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && !data && (
          <p className="mt-6 text-center font-mono text-sm text-muted-foreground">loading…</p>
        )}
      </main>
    </div>
  );
}
