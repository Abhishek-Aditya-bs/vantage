/**
 * Landing — the marketing centerpiece, rebuilt as a technical reference manual.
 * Strict monochrome. Tight Geist display, editorial EB Garamond body, Geist Mono
 * labels. Hand-authored black-and-white blueprint figures carry every section;
 * Factory-style numeric anchors, hairline rules, and ░ dividers set the rhythm.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { listSpaces, forgetSpace, type RecentSpace } from "@/lib/spaces";
import { formatCode } from "@/lib/format";
import { PixelHeadline } from "@/components/brand/PixelHeadline";
import { AsciiColophon } from "@/components/brand/AsciiColophon";
import { BlueprintFigure } from "@/components/landing/BlueprintFigure";
import { FilmPlate } from "@/components/landing/FilmPlate";
import { ShadeDivider } from "@/components/landing/ShadeDivider";
import { FigSyncCapture } from "@/components/landing/figures/FigSyncCapture";
import { FigAperture } from "@/components/landing/figures/FigAperture";
import { FigLiveWall } from "@/components/landing/figures/FigLiveWall";
import { FigArchitecture } from "@/components/landing/figures/FigArchitecture";
import { SPACE_QUOTAS } from "@shared/constants";

const reveal = {
  initial: { opacity: 0, y: 10 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

export default function Landing() {
  const [recent, setRecent] = useState<RecentSpace[]>([]);
  useEffect(() => setRecent(listSpaces()), []);
  const forget = (code: string) => {
    forgetSpace(code);
    setRecent(listSpaces());
  };

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader>
        <Button asChild variant="outline" size="sm" className="hidden font-mono text-xs sm:inline-flex">
          <Link to="/create">
            START A SPACE <ArrowRight />
          </Link>
        </Button>
      </AppHeader>

      <main id="main">
        {/* ============================== HERO ============================= */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.5]" />
          <Shell className="relative pt-14 pb-12 sm:pt-20 sm:pb-16">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-muted-foreground"
            >
              Multi-angle capture · up to {SPACE_QUOTAS.maxMembers} phones · real-time
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 font-display font-semibold leading-[0.92] tracking-[-0.035em]"
              style={{ fontSize: "clamp(2.85rem, 9vw, 6.5rem)" }}
            >
              Every phone.
              <br />
              One instant.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              className="mt-7 max-w-xl font-serif text-xl leading-relaxed text-muted-foreground"
            >
              Scan a QR to join a <em className="not-italic text-foreground">space</em>. Every photo anyone
              takes streams onto a shared <em className="not-italic text-foreground">live wall</em> as it
              happens. Then anyone fires a <em className="not-italic text-foreground">Moment</em> — and every
              phone in the room captures the same instant into one multi-angle artifact.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
              className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              <Button asChild size="xl">
                <Link to="/create">
                  Start a space <ArrowRight />
                </Link>
              </Button>
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                no app · no account · free
              </span>
            </motion.div>

            {/* resume any space you've created or joined (persists across tabs) */}
            {recent.length > 0 && (
              <motion.div {...reveal} className="mt-12 max-w-xl">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.26em] text-muted-foreground">
                  Your spaces — resume
                </p>
                <ul className="mt-3 divide-y divide-border border-y border-border">
                  {recent.map((s) => (
                    <li key={s.code} className="flex items-center justify-between gap-3 py-3">
                      <Link to={`/s/${s.code}`} className="group flex min-w-0 items-baseline gap-3">
                        <span className="truncate font-display text-base font-semibold tracking-tight group-hover:underline">
                          {s.name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{formatCode(s.code)}</span>
                        <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                          {s.role}
                        </span>
                      </Link>
                      <div className="flex shrink-0 items-center gap-3">
                        <Link
                          to={`/s/${s.code}`}
                          className="font-mono text-xs uppercase tracking-[0.12em] text-foreground hover:underline"
                        >
                          Rejoin →
                        </Link>
                        <button
                          type="button"
                          onClick={() => forget(s.code)}
                          aria-label={`Forget ${s.name}`}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </Shell>

          {/* hero figure — the synchronized-capture schematic */}
          <Shell className="relative pb-16 sm:pb-20">
            <motion.div {...reveal}>
              <BlueprintFigure fig="FIG_001" caption="SYNCHRONIZED CAPTURE">
                <FigSyncCapture />
              </BlueprintFigure>
            </motion.div>
          </Shell>
        </section>

        <ShadeDivider />

        {/* ============================ THE FILM ========================== */}
        <Section>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-10">
            <motion.div {...reveal} className="md:col-span-4">
              <Eyebrow n="00">In motion</Eyebrow>
              <H2>Watch a room become one camera.</H2>
              <Lede>
                Fifty-four seconds, drawn in the same blueprint as everything below: a phone scans in,
                the wall fills itself, every angle fires one synchronized shutter, and the night plays
                itself back as a reel.
              </Lede>
            </motion.div>
            <motion.div {...reveal} className="md:col-span-8">
              <FilmPlate />
            </motion.div>
          </div>
        </Section>

        <ShadeDivider />

        {/* ========================= 01 — THE MOMENT ====================== */}
        <Section>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:items-center md:gap-10">
            <motion.div {...reveal} className="md:col-span-5">
              <Eyebrow n="01">The Moment</Eyebrow>
              <H2>Fire one synchronized shutter.</H2>
              <Lede>
                Trigger a Moment and every connected phone runs the same countdown — clocks aligned over the
                wire — then releases its shutter at one server instant. The room photographs a single moment
                from every angle at once.
              </Lede>
              <SpecList
                items={[
                  "clocks sync over the socket",
                  "iris countdown on every screen",
                  "auto-capture at T-zero",
                  "frames stitched into one artifact",
                ]}
              />
            </motion.div>
            <motion.div {...reveal} className="md:col-span-7">
              <BlueprintFigure fig="FIG_003" caption="MOMENT MECHANISM">
                <FigAperture />
              </BlueprintFigure>
            </motion.div>
          </div>
        </Section>

        <ShadeDivider />

        {/* ======================== 02 — THE LIVE WALL ==================== */}
        <Section>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:items-center md:gap-10">
            <motion.div {...reveal} className="md:order-2 md:col-span-5">
              <Eyebrow n="02">The Live Wall</Eyebrow>
              <H2>A contact sheet that fills itself.</H2>
              <Lede>
                Every photo anyone shoots lands on a shared surface in real time, tagged with who took it and
                when. No refresh, no upload screen — the whole event assembles itself in one place as it
                happens.
              </Lede>
              <SpecList
                items={[
                  "one tile per photo, instantly",
                  "author + timestamp on every frame",
                  "streamed over a live websocket",
                  "the room, assembling in one place",
                ]}
              />
            </motion.div>
            <motion.div {...reveal} className="md:order-1 md:col-span-7">
              <BlueprintFigure fig="FIG_002" caption="THE LIVE WALL">
                <FigLiveWall />
              </BlueprintFigure>
            </motion.div>
          </div>
        </Section>

        <ShadeDivider />

        {/* ============================ 03 — JOIN ========================= */}
        <Section>
          <motion.div {...reveal} className="max-w-2xl">
            <Eyebrow n="03">Join</Eyebrow>
            <H2>Scan. Name. Shoot.</H2>
            <Lede>
              The join link is the whole invitation. Share a QR or a code; anyone opens it in a phone browser,
              picks a name, and they are on the wall. No install, no account, no friction.
            </Lede>
          </motion.div>
          <motion.ol
            {...reveal}
            className="mt-10 grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-3"
          >
            {[
              { n: "01", t: "Start a space", d: "Name it, name yourself. You get a QR and a share link." },
              { n: "02", t: "Share the code", d: "Friends scan the QR or open the link in any browser." },
              { n: "03", t: "Shoot together", d: "Photos hit the wall live; the host can fire a Moment." },
            ].map((s) => (
              <li key={s.n} className="bg-background p-7">
                <span className="font-mono text-xs tracking-[0.2em] text-muted-foreground">{s.n}</span>
                <h3 className="mt-4 font-display text-xl font-semibold tracking-tight">{s.t}</h3>
                <p className="mt-2 font-serif text-base leading-relaxed text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </motion.ol>
        </Section>

        <ShadeDivider />

        {/* ====================== 04 — EDGE TOPOLOGY ====================== */}
        <Section>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:items-center md:gap-10">
            <motion.div {...reveal} className="md:col-span-5">
              <Eyebrow n="04">Topology</Eyebrow>
              <H2>Runs on the edge. Costs nothing.</H2>
              <Lede>
                No origin server. Each space is one Durable Object living at the edge, holding its own photos
                and the live socket; a separate rate-limiter guards every entrance. The whole thing fits inside
                a free tier.
              </Lede>
              <dl className="mt-8 divide-y divide-border border-y border-border font-mono text-sm">
                {[
                  ["PER-IP LIMITS", "spaces · joins · uploads"],
                  ["PER-SPACE QUOTA", "50 people · 300 photos"],
                  ["CAPABILITY TOKENS", "signed, scoped to one space"],
                  ["AUTO-EXPIRE", "spaces vanish after 7 days"],
                  ["COST", "$0 / mo · no card"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>
            <motion.div {...reveal} className="md:col-span-7">
              <BlueprintFigure fig="FIG_004" caption="EDGE TOPOLOGY">
                <FigArchitecture />
              </BlueprintFigure>
            </motion.div>
          </div>
        </Section>

        <ShadeDivider />

        {/* ============================== CTA ============================= */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.4]" />
          <Shell className="relative py-24 text-center sm:py-32">
            <motion.div {...reveal} className="flex flex-col items-center">
              <PixelHeadline text="VANTAGE" height={54} cell={6.4} title="Vantage" className="text-foreground" />
              <h2 className="mt-8 font-display font-semibold tracking-[-0.03em]" style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}>
                Start a space.
              </h2>
              <p className="mx-auto mt-5 max-w-md font-serif text-xl leading-relaxed text-muted-foreground">
                Spin one up, share the QR, and let the whole room shoot the same moment together.
              </p>
              <Button asChild size="xl" className="mt-9">
                <Link to="/create">
                  Create your space <ArrowRight />
                </Link>
              </Button>
            </motion.div>
          </Shell>
        </section>
      </main>

      <AsciiColophon />
    </div>
  );
}

/* ----------------------------- layout atoms ----------------------------- */

function Shell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className ?? ""}`}>{children}</div>;
}

function Section({ children }: { children: ReactNode }) {
  return (
    <section>
      <Shell className="py-16 sm:py-24">{children}</Shell>
    </section>
  );
}

function Eyebrow({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="font-mono text-[0.7rem] uppercase tracking-[0.26em] text-muted-foreground">
      <span className="text-foreground">[ {n} ]</span>&nbsp;&nbsp;{children}
    </p>
  );
}

function H2({ children }: { children: ReactNode }) {
  return (
    <h2
      className="mt-4 font-display font-semibold leading-[1.04] tracking-[-0.03em]"
      style={{ fontSize: "clamp(2rem, 4.4vw, 3.25rem)" }}
    >
      {children}
    </h2>
  );
}

function Lede({ children }: { children: ReactNode }) {
  return <p className="mt-6 max-w-md font-serif text-xl leading-relaxed text-muted-foreground">{children}</p>;
}

function SpecList({ items }: { items: string[] }) {
  return (
    <ul className="mt-8 divide-y divide-border border-y border-border font-mono text-sm">
      {items.map((t, i) => (
        <li key={t} className="flex items-baseline gap-4 py-2.5">
          <span className="tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
          <span className="h-px w-4 translate-y-[-3px] bg-border" />
          <span className="text-foreground">{t}</span>
        </li>
      ))}
    </ul>
  );
}
