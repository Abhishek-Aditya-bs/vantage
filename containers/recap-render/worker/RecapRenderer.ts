/**
 * RecapRenderer — the Durable Object that fronts the recap render Container.
 *
 * This file is intentionally kept OUT of the default Worker build (it lives under
 * containers/, not worker/) so the project type-checks and deploys on the free
 * tier without the `@cloudflare/containers` dependency or a container image.
 *
 * To enable the server render path (Phase-2, needs Workers Paid):
 *   1. npm i @cloudflare/containers
 *   2. Copy this file to worker/recap-renderer.ts
 *   3. In worker/index.ts add:  export { RecapRenderer } from "./recap-renderer";
 *   4. Uncomment the `containers` + RECAP_RENDERER binding + migration in wrangler.jsonc
 *   5. Set vars.RENDER_MODE = "server"  (and `wrangler secret put RENDER_SECRET`)
 *
 * The base `Container` class proxies inbound stub `.fetch()` calls to the
 * container's HTTP server (server.mjs on port 8080), which is exactly what
 * worker/render.ts -> serverRecap() relies on.
 */
import { Container } from "@cloudflare/containers";

export class RecapRenderer extends Container {
  /** the port server.mjs listens on */
  defaultPort = 8080;
  /** scale the container back to zero after a short idle to keep costs near $0 */
  sleepAfter = "5m";
  /** pass the shared secret through to the render service */
  envVars = {
    RENDER_SECRET: (this.env as { RENDER_SECRET?: string }).RENDER_SECRET ?? "",
  };
}
