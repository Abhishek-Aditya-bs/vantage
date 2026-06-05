/**
 * Join — preview a space by code, then enter with a display name.
 * Fetches the public SpacePublic for a preview card; POSTs to join on submit.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Users, Images } from "lucide-react";
import { MAX_DISPLAY_NAME } from "@shared/constants";
import type { SpacePublic } from "@shared/protocol";
import { api, ApiError } from "@/lib/api";
import { formatCode } from "@/lib/format";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Turnstile } from "@/components/Turnstile";
import { IrisShutter } from "@/components/brand/IrisShutter";
import { Mascot } from "@/components/brand/Mascot";
import { useToast } from "@/components/ui/toast";

export default function Join() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [space, setSpace] = useState<SpacePublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load the public preview for this code.
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setLoadError(null);
    api
      .getSpace(code, ctrl.signal)
      .then(setSpace)
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? "That space code doesn't exist or has expired."
            : "Couldn't load that space.",
        );
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [code]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.joinSpace(code, {
        displayName: displayName.trim(),
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      navigate(
        `/s/${res.space.code}?t=${encodeURIComponent(res.token)}`,
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not join the space.";
      toast({ title: "Join failed", description: message, tone: "error" });
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main
        id="main"
        className="mx-auto flex w-full max-w-lg flex-col px-5 py-12 md:py-20"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <IrisShutter size={88} ariaLabel="Loading space" />
            <p className="font-mono text-sm text-muted-foreground">
              opening {formatCode(code)}…
            </p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-card p-10 text-center">
            <Mascot size={72} />
            <div>
              <h1 className="font-display text-2xl font-bold">Can&rsquo;t join</h1>
              <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/create">Start your own space</Link>
            </Button>
          </div>
        ) : (
          space && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
            >
              {/* preview card */}
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
                <Badge variant="primary" className="mb-4">
                  you&rsquo;re invited
                </Badge>
                <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
                  {space.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4" /> {space.memberCount} here
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Images className="size-4" /> {space.mediaCount} photos
                  </span>
                  <span className="text-foreground">{formatCode(space.code)}</span>
                </div>

                <form onSubmit={onSubmit} className="mt-7 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Your name on the wall</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={MAX_DISPLAY_NAME}
                      placeholder="Tanvi"
                      autoComplete="name"
                      required
                      autoFocus
                    />
                  </div>

                  <Turnstile onToken={setTurnstileToken} />

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={submitting || !displayName.trim()}
                  >
                    {submitting ? (
                      <>
                        <IrisShutter size={20} ariaLabel="Joining" />
                        Joining…
                      </>
                    ) : (
                      <>
                        Join the wall
                        <ArrowRight />
                      </>
                    )}
                  </Button>
                </form>
              </div>
              <p className="mt-4 text-center font-mono text-[0.7rem] text-muted-foreground">
                free · no account · your photos stay in this space
              </p>
            </motion.div>
          )
        )}
      </main>
    </div>
  );
}
