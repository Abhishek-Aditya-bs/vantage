# Vantage — every angle, one moment

**Turn a room full of phones into one synchronized, multi-angle camera.**

Vantage is a real-time, multi-camera event-capture app. Scan a QR to join a *space*; everyone's photos stream onto a shared **live wall** as they happen. Then anyone triggers a **Moment** — every connected phone runs the same countdown, clocks aligned over the wire, and fires its shutter at the *exact same instant*, producing one instant photographed from every angle in the room.

It runs **entirely on the Cloudflare developer platform**, and — by design — **entirely on the free tier**. No origin server, no R2, no credit card, no container required.

🔗 **Live:** https://vantage.abhishek-aditya10.workers.dev

<p align="center">
  <img src="docs/landing-dark.png" alt="Vantage landing page (dark)" width="49%">
  <img src="docs/space-room.png" alt="Vantage live space room" width="49%">
</p>

---

## What it does

- **Join by QR / link** — no app, no account. Tap in from any phone browser, pick a name, you're on the wall.
- **Live wall** — every photo lands on a shared, real-time contact sheet, tagged with who shot it and when. Tiles animate in as they arrive.
- **Synchronized Moments** — the host triggers a 3·2·1 iris countdown that fires on *every* connected device at the same server-time instant. The frames are grouped into one multi-angle artifact.
- **Auto-recap reel** — a montage of the whole space plays back with film-strip crossfades and Ken-Burns on stills.
- **Light + dark**, mobile-first, installable PWA.

---

## Why it's interesting: a tour of the Cloudflare stack

The whole point of this project was to exercise the *entire* Cloudflare edge platform in one coherent product. Every primitive earns its place:

| Primitive | Role in Vantage |
|---|---|
| **Workers** (Hono) | API gateway: auth, Turnstile, rate-limiting, routing to Durable Objects. The Worker only runs for `/api/*`; static assets are served directly. |
| **Durable Objects** (SQLite, **free tier**) ⭐ | `SpaceRoom` — one DO per space. The real-time core: WebSocket **Hibernation** (idle sockets are free), presence, the live wall, the synchronized-Moment protocol, and **media stored directly in the DO's SQLite** (see below). |
| **Durable Objects** | `RateLimiter` — a second DO class implementing a sharded, strongly-consistent sliding-window limiter. |
| **D1** (Drizzle ORM) | A global registry of spaces, so a Cron Trigger can enumerate and expire them (you can't list Durable Objects). |
| **KV** | Edge config / hot lookups (read-optimized; deliberately kept off the write hot-path to respect the 1k-writes/day free cap). |
| **Workers AI** | Wired for optional image moderation (LlamaGuard) within the 10k-neuron/day free budget. |
| **Cron Triggers** | Nightly cleanup of inactive/expired spaces to free DO storage. |
| **Pages / Workers Assets** | Serves the installable React PWA; SPA fallback for client-side routing. |

### The "no R2, no credit card" decision

R2 would be the obvious place to store photos — but enabling R2 requires a **payment method even for the $0 free tier** (Cloudflare error `10042`). To keep Vantage *genuinely* free and card-free, media is stored as BLOBs in each space's **Durable Object SQLite** (the per-value 2 MB cap is plenty for client-compressed photos; quotas keep a space inside the 1 GB/DO free limit). Storage is feature-flagged (`STORAGE_MODE`), so flipping to R2 later is a one-line change.

### The synchronized-Moment protocol

1. Each client periodically sends a `clock_ping`; the DO replies with its server time. The client estimates a clock **offset** (`serverNow − (t0 + rtt/2)`, EMA-smoothed).
2. The host triggers a Moment → the DO picks a `captureAt` server timestamp ~3 s out and broadcasts it to everyone.
3. Each device converts `captureAt` to *local* time using its offset, runs the iris countdown, and auto-captures a frame at T₀.
4. Frames upload tagged with the `momentId`; a DO **alarm** finalizes the Moment and broadcasts the assembled multi-angle set.

---

## Security & abuse-prevention (free tier)

- **Capability tokens** — the join link *is* the credential: short-lived HS256 JWTs (`jose`), scoped to one space + role, validated and enforced for permissions *inside* the Durable Object (only the host can trigger Moments).
- **App-layer rate limiting** — sliding-window limits on space creation, joins, uploads, WebSocket messages, and Moment triggers (the `RateLimiter` DO + an in-DO per-socket throttle), since WAF rate-limiting isn't on the free plan for `*.workers.dev`.
- **Per-space quotas** — max members / media items / bytes, plus 7-day auto-expiry via Cron, to keep storage and D1/KV writes inside the free tier.
- **Cloudflare DDoS** — always-on L3/4 + L7 network scrubbing applies automatically (even on `workers.dev`).
- **Turnstile** — wired into create/join (server-side `siteverify`); ships with Cloudflare's test key and fails-open, so it's a one-step upgrade to real enforcement.
- **Hardening** — signed-secret config, security headers + CSP (`public/_headers` for the shell, middleware for the API), R2-never-exposed pattern (when R2 is used), unguessable media IDs.

> **Free upgrade:** putting Vantage behind a free Cloudflare-managed custom domain unlocks WAF custom rules, free rate-limiting rules, and Bot Fight Mode — none of which apply to a bare `*.workers.dev` host.

---

## Tech stack

**Frontend:** React 19 · Vite · TypeScript (strict) · Tailwind CSS v4 · shadcn-style primitives · `motion` · self-hosted Bricolage Grotesque / DM Sans / Space Mono · hand-authored pixel-art (mascot, avatars, iris shutter) and ASCII craft.
**Edge:** Cloudflare Workers · Hono · Durable Objects (SQLite + Hibernation) · D1 · KV · Workers AI · Cron · `jose` · `aws4fetch` · Drizzle ORM · Zod (shared client/worker contract).
**Tooling:** `@cloudflare/vite-plugin` (one dev server for SPA + Worker + DOs) · Wrangler · drizzle-kit.

Design direction: **"Swiss Editorial + Lo-Fi Pixel,"** palette **"Darkroom Amber"** — deliberately engineered to avoid the indigo-gradient / glassmorphism / Inter "AI-slop" default.

---

## Local development

```bash
npm install
npm run dev          # Vite + Worker + Durable Objects in one local server
```

Apply the D1 schema locally once:

```bash
npx wrangler d1 execute vantage --local --file=worker/db/migrations/0000_naive_black_crow.sql
```

Type-check & build:

```bash
npm run build        # tsc -b (client + worker + node) && vite build
```

## Deploy

```bash
npm run deploy       # build, then wrangler deploy the Vite-plugin output
# one-time: set the signing secret
printf '%s' "$(openssl rand -hex 32)" | npx wrangler secret put JWT_SECRET
```

Bindings (D1 / KV / Durable Objects / AI) are declared in `wrangler.jsonc`; resources are created with `wrangler d1 create`, `wrangler kv namespace create`, etc.

## Configuration & feature flags

Set in `wrangler.jsonc` (`vars`) or as secrets:

| Flag | Default | Meaning |
|---|---|---|
| `STORAGE_MODE` | `do` | `do` = media in Durable Object SQLite (free, no R2). `r2` = optional upgrade once R2 is enabled. |
| `RENDER_MODE` | `client` | `client` = recap rendered on-device (free). `server` = Phase-2 ffmpeg container ($5 Workers Paid). |
| `TURNSTILE_SITE_KEY` | test key | Replace with a real key (+ `TURNSTILE_SECRET`) to enforce Turnstile. |
| `JWT_SECRET` (secret) | dev fallback | HMAC signing secret — **always set in production**. |

### Roadmap / optional upgrades (all behind flags)
- **Server-side recap render** — a Cloudflare Container running `ffmpeg`, triggered via Workflows/Queues (needs the $5 Workers Paid plan).
- **R2 storage** — flip `STORAGE_MODE=r2` once R2 is enabled.
- **Real Turnstile + custom domain** — for enforced bot protection and free WAF rate-limiting.
- **Workers AI moderation** — enable LlamaGuard screening on uploads.

---

## Project structure

```
vantage/
├── worker/                 # Cloudflare Worker (edge)
│   ├── index.ts            # Hono gateway + routes + Cron + DO exports
│   ├── space-room.ts       # SpaceRoom Durable Object (realtime + media + Moments)
│   ├── rate-limiter.ts     # RateLimiter Durable Object (sliding window)
│   ├── auth.ts             # capability-token JWTs (jose)
│   ├── turnstile.ts        # Turnstile siteverify
│   ├── security.ts         # security headers / CORS
│   └── db/                 # Drizzle D1 schema + migrations
├── shared/                 # Zod contract shared by client + worker
│   ├── protocol.ts         # REST + WebSocket message types
│   └── constants.ts        # quotas, limits, timings
├── src/                    # React PWA (client)
│   ├── routes/             # Landing, Create, Join, Space, NotFound
│   ├── components/         # ui/ · brand/ · landing/ · space/
│   ├── lib/                # api · useSpaceSocket · capture · pixel
│   └── providers/          # theme
├── public/                 # manifest, icons, _headers (CSP)
└── wrangler.jsonc          # bindings, migrations, cron
```

---

Built end-to-end on Cloudflare — for the moment, not the cloud.
