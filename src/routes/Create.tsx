/**
 * Create — spin up a new space.
 * Two states: the form, and the "space ready" panel (shareable URL + QR + enter).
 */
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Copy, Check } from "lucide-react";
import { MAX_DISPLAY_NAME, MAX_SPACE_NAME } from "@shared/constants";
import type { AuthResult } from "@shared/protocol";
import { api, ApiError } from "@/lib/api";
import { formatCode } from "@/lib/format";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Turnstile } from "@/components/Turnstile";
import { QrCode } from "@/components/brand/QrCode";
import { IrisShutter } from "@/components/brand/IrisShutter";
import { useToast } from "@/components/ui/toast";

export default function Create() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [spaceName, setSpaceName] = useState("");
  const [hostName, setHostName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!spaceName.trim() || !hostName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.createSpace({
        name: spaceName.trim(),
        hostName: hostName.trim(),
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      setResult(res);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not create the space.";
      toast({ title: "Create failed", description: message, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main
        id="main"
        className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-12 md:grid-cols-12 md:py-20"
      >
        {/* editorial intro column */}
        <div className="md:col-span-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            new space
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[0.98] tracking-tight sm:text-5xl">
            Open the
            <br />
            aperture.
          </h1>
          <p className="mt-5 max-w-sm text-muted-foreground">
            Name your space and yourself. You&rsquo;ll get a QR and a link to
            share — anyone who scans it joins the live wall instantly.
          </p>
          <div className="mt-8 hidden md:block">
            <IrisShutter size={140} />
          </div>
        </div>

        {/* form / result column */}
        <div className="md:col-span-7 md:pl-8">
          {!result ? (
            <motion.form
              onSubmit={onSubmit}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              className="rounded-xl border border-border bg-card p-6 sm:p-8"
            >
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="spaceName">Space name</Label>
                  <Input
                    id="spaceName"
                    value={spaceName}
                    onChange={(e) => setSpaceName(e.target.value)}
                    maxLength={MAX_SPACE_NAME}
                    placeholder="Maya & Dev's wedding"
                    autoComplete="off"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hostName">Your name</Label>
                  <Input
                    id="hostName"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    maxLength={MAX_DISPLAY_NAME}
                    placeholder="Abhishek"
                    autoComplete="name"
                    required
                  />
                </div>

                <Turnstile onToken={setTurnstileToken} className="pt-1" />

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={submitting || !spaceName.trim() || !hostName.trim()}
                >
                  {submitting ? (
                    <>
                      <IrisShutter size={20} ariaLabel="Creating" />
                      Creating…
                    </>
                  ) : (
                    <>
                      Create space
                      <ArrowRight />
                    </>
                  )}
                </Button>
                <p className="text-center font-mono text-[0.7rem] text-muted-foreground">
                  you&rsquo;ll be the host · spaces expire after 7 days
                </p>
              </div>
            </motion.form>
          ) : (
            <SpaceReady
              result={result}
              onEnter={() =>
                navigate(
                  `/s/${result.space.code}?t=${encodeURIComponent(result.token)}`,
                )
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}

/** Success panel: join URL + QR + enter button. */
function SpaceReady({
  result,
  onEnter,
}: {
  result: AuthResult;
  onEnter: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast({ title: "Link copied", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy", tone: "error" });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
      className="rounded-xl border border-border bg-card p-6 sm:p-8"
    >
      <Badge variant="live" className="mb-4">
        <span className="inline-block size-1.5 rounded-full bg-live" />
        space is live
      </Badge>
      <h2 className="font-display text-2xl font-bold tracking-tight">
        {result.space.name}
      </h2>
      <p className="mt-1 font-mono text-sm text-muted-foreground">
        code{" "}
        <span className="text-foreground">{formatCode(result.space.code)}</span>
      </p>

      <div className="mt-6 grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_1fr]">
        <QrCode value={result.joinUrl} size={168} />
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">share this link</Label>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs">
                {result.joinUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copy}
                aria-label="Copy join link"
              >
                {copied ? (
                  <Check className="size-4 text-live" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Guests scan the QR or open the link, pick a name, and they&rsquo;re on
            the wall.
          </p>
        </div>
      </div>

      <Button size="lg" className="mt-7 w-full" onClick={onEnter}>
        Enter space
        <ArrowRight />
      </Button>
    </motion.div>
  );
}
