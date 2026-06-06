/**
 * Server-side recap render dispatcher (Phase-2).
 *
 *   RENDER_MODE=client (default) → recap is rendered on-device; this module is inert.
 *   RENDER_MODE=server           → recap is rendered by an ffmpeg Cloudflare Container.
 *
 * The container is fronted by a Durable Object whose class extends
 * `@cloudflare/containers` `Container` (see containers/recap-render/). We only
 * ever call the *standard* DO stub `.fetch()`, so this file type-checks and
 * deploys on the free tier with the container absent and the binding unset — the
 * whole path is gated behind `serverRenderAvailable()`.
 */
import type { AppEnv } from "./env";
import { renderMode } from "./env";

export interface RecapFrame {
  /** absolute, publicly fetchable image URL (the Worker's /api/m/:code/:id) */
  url: string;
  displayName: string;
}

export interface RecapManifest {
  title: string;
  width: number;
  height: number;
  /** hold time per still, milliseconds */
  msPerFrame: number;
  frames: RecapFrame[];
}

/** True only when a server render is both requested AND wired up. */
export function serverRenderAvailable(env: AppEnv): boolean {
  return renderMode(env) === "server" && !!env.RECAP_RENDERER;
}

/**
 * Dispatch a manifest to the render container and return its streamed response
 * (an `video/mp4` body on success). A fixed instance name keeps one warm
 * renderer per region. Returns a 501 if somehow called without a binding.
 */
export async function serverRecap(env: AppEnv, manifest: RecapManifest): Promise<Response> {
  const ns = env.RECAP_RENDERER;
  if (!ns) {
    return new Response(JSON.stringify({ error: "renderer not configured" }), {
      status: 501,
      headers: { "Content-Type": "application/json" },
    });
  }
  const stub = ns.get(ns.idFromName("recap-renderer"));
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.RENDER_SECRET) headers["X-Render-Secret"] = env.RENDER_SECRET;
  return stub.fetch("https://renderer/render", {
    method: "POST",
    headers,
    body: JSON.stringify(manifest),
  });
}
