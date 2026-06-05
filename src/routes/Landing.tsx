/**
 * Landing — the marketing centerpiece. Swiss editorial grid, big Bricolage
 * display type, hairline rules, a contact-sheet/film motif, and the
 * iris-shutter as the hero device. Every section explains one part of Vantage.
 */
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, QrCode, Radio, Lock, Zap } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IrisShutter } from "@/components/brand/IrisShutter";
import { Mascot } from "@/components/brand/Mascot";
import { AsciiColophon } from "@/components/brand/AsciiColophon";
import { HowAMomentWorks } from "@/components/landing/HowAMomentWorks";
import { LiveWallPreview } from "@/components/landing/LiveWallPreview";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

export default function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader>
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link to="/create">Start a space</Link>
        </Button>
      </AppHeader>

      <main id="main">
        {/* ============================= HERO ============================= */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.35]" />
          <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-16 md:grid-cols-12 md:gap-6 md:py-24">
            {/* left: editorial headline */}
            <div className="md:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-wrap items-center gap-2"
              >
                <Badge variant="primary">multi-camera capture</Badge>
                <Badge variant="live">
                  <span className="inline-block size-1.5 rounded-full bg-live" />
                  real-time
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
                className="mt-6 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl md:text-[5.5rem]"
              >
                Every angle.
                <br />
                <span className="text-primary">One moment.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: "easeOut", delay: 0.12 }}
                className="mt-6 max-w-xl text-lg text-muted-foreground"
              >
                Scan a QR to join a <strong className="text-foreground">space</strong>.
                Everyone&rsquo;s photos stream onto a shared{" "}
                <strong className="text-foreground">live wall</strong> as they happen.
                Then anyone triggers a{" "}
                <strong className="text-moment">Moment</strong> — every phone
                captures the same instant into one multi-angle artifact.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: "easeOut", delay: 0.18 }}
                className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <Button asChild size="xl">
                  <Link to="/create">
                    Start a space
                    <ArrowRight />
                  </Link>
                </Button>
                <p className="font-mono text-xs text-muted-foreground">
                  no app · no account · free
                </p>
              </motion.div>

              {/* hairline stat row */}
              <dl className="mt-12 grid grid-cols-3 gap-px border-y border-border bg-border">
                {[
                  ["50", "people / space"],
                  ["1", "synced instant"],
                  ["∞", "angles, one frame"],
                ].map(([n, label]) => (
                  <div key={label} className="bg-background px-4 py-4">
                    <dt className="font-display text-3xl font-bold tabular-nums">
                      {n}
                    </dt>
                    <dd className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* right: iris-shutter + mascot device */}
            <div className="md:col-span-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                className="grain relative mx-auto flex aspect-square max-w-sm flex-col items-center justify-center rounded-xl border border-border bg-card p-8"
              >
                <span className="grain-overlay" />
                <IrisShutter size={220} ariaLabel="Vantage aperture" />
                <div className="mt-6 flex items-center gap-3">
                  <Mascot size={40} />
                  <div className="text-left">
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
                      aperture · open
                    </p>
                    <p className="font-display text-sm font-semibold">
                      ready to capture
                    </p>
                  </div>
                </div>
                {/* corner registration marks (camera framing) */}
                <Corner className="left-3 top-3" />
                <Corner className="right-3 top-3 rotate-90" />
                <Corner className="bottom-3 left-3 -rotate-90" />
                <Corner className="bottom-3 right-3 rotate-180" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ====================== HOW A MOMENT WORKS ====================== */}
        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-16 md:grid-cols-12 md:py-24">
            <motion.div {...fadeUp} className="md:col-span-5">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
                /01 — the moment
              </p>
              <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Three phones.
                <br />
                One instant.
              </h2>
              <p className="mt-5 max-w-md text-muted-foreground">
                When a Moment is triggered, every connected phone runs the same
                synchronized countdown — clocks aligned over the wire — and fires
                its shutter at the exact same server time. The result is a single
                instant photographed from every angle in the room.
              </p>
              <ul className="mt-6 space-y-3 font-mono text-sm">
                {[
                  "clocks sync over the socket",
                  "iris countdown on every screen",
                  "auto-capture at T₀",
                  "frames stitched into one artifact",
                ].map((t, i) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="text-primary tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px w-5 bg-border" />
                    <span className="text-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div {...fadeUp} className="md:col-span-7 md:pl-8">
              <div className="rounded-xl border border-border bg-card p-6 sm:p-10">
                <HowAMomentWorks />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ========================= LIVE WALL =========================== */}
        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-16 md:grid-cols-12 md:py-24">
            <motion.div {...fadeUp} className="md:col-span-7 md:order-2">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                /02 — the live wall
              </p>
              <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                A contact sheet that fills itself.
              </h2>
              <p className="mt-5 max-w-md text-muted-foreground">
                Every photo anyone takes lands on a shared wall in real time —
                tiles drop onto the surface from the edges, tagged with who shot
                them and when. It&rsquo;s the whole event, assembling live, in one
                place.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="accent">
                  <Radio className="size-3" /> websocket-live
                </Badge>
                <Badge variant="outline">masonry · staggered entrance</Badge>
              </div>
            </motion.div>
            <motion.div {...fadeUp} className="md:order-1 md:col-span-5">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>live wall</span>
                  <span className="flex items-center gap-1.5 text-live">
                    <span className="inline-block size-1.5 animate-pulse rounded-full bg-live" />
                    streaming
                  </span>
                </div>
                <LiveWallPreview />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ===================== RECAP + TRUST ROW ====================== */}
        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-px bg-border md:grid-cols-3">
            {[
              {
                icon: Zap,
                title: "Auto-recap reel",
                body: "When it&rsquo;s over, a montage of the whole space plays back — film-strip crossfades, Ken-Burns on stills.",
              },
              {
                icon: QrCode,
                title: "Join by QR",
                body: "Share a code or QR. Guests tap in from any phone browser — no install, no sign-up, just a name.",
              },
              {
                icon: Lock,
                title: "Free, private, ephemeral",
                body: "Spaces are invite-only and auto-expire after 7 days. Built to run inside a free tier — no surveillance.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <motion.div
                key={title}
                {...fadeUp}
                className="bg-background p-8"
              >
                <Icon className="size-5 text-primary" />
                <h3 className="mt-4 font-display text-xl font-semibold">
                  {title}
                </h3>
                <p
                  className="mt-2 text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============================= CTA ============================= */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20 text-center">
          <motion.div {...fadeUp}>
            <IrisShutter size={88} className="mx-auto" />
            <h2 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-6xl">
              Start a space.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Spin one up, share the QR, and let the room shoot together.
            </p>
            <Button asChild size="xl" className="mt-8">
              <Link to="/create">
                Create your space
                <ArrowRight />
              </Link>
            </Button>
          </motion.div>
        </section>
      </main>

      <AsciiColophon />
    </div>
  );
}

/** Camera-framing corner registration mark. */
function Corner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute size-4 border-l-2 border-t-2 border-primary/60 ${className ?? ""}`}
    />
  );
}
