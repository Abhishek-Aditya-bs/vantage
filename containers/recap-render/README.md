# Recap renderer — Phase-2 server render (ffmpeg in a Cloudflare Container)

This is the **server-side** recap pipeline. By default Vantage renders the recap
**on-device** (`RENDER_MODE=client`) and this container is never built or billed.
Enabling it gives a higher-quality, deterministic MP4 (Ken-Burns + crossfades) at
the cost of the **Workers Paid plan** (~$5/mo) that Containers require.

```
client (default)            server (this container)
──────────────────          ────────────────────────────────────────────────
RecapReel exports     │      Worker  POST /api/spaces/:code/recap
a WebM/MP4 in the     │        → render.ts serverRecap()
browser (free)        │          → RECAP_RENDERER DO  (@cloudflare/containers)
                      │            → server.mjs  (Node + ffmpeg)  → video/mp4
```

## Files
- `Dockerfile` — Node 20 + ffmpeg image.
- `server.mjs` — dependency-free HTTP render service (`POST /render` → `video/mp4`).
- `worker/RecapRenderer.ts` — the Container-backed Durable Object that fronts it.
- `package.json` — container metadata.

## Enable it
1. **Plan:** upgrade to Workers Paid (Containers aren't on the free plan).
2. **Dep:** `npm i @cloudflare/containers`
3. **Wire the DO class into the Worker build:**
   ```bash
   cp containers/recap-render/worker/RecapRenderer.ts worker/recap-renderer.ts
   ```
   then add to `worker/index.ts`:
   ```ts
   export { RecapRenderer } from "./recap-renderer";
   ```
4. **wrangler.jsonc:** uncomment the `RECAP_RENDERER` durable-object binding, the
   `containers` block, and the `RecapRenderer` migration (all marked
   `PHASE-2 / server render` in that file).
5. **Flags & secrets:**
   ```bash
   # set "RENDER_MODE": "server" in wrangler.jsonc vars, then:
   printf '%s' "$(openssl rand -hex 24)" | npx wrangler secret put RENDER_SECRET
   ```
6. **Deploy:** `npm run deploy` (Wrangler builds & pushes the image).

To roll back to the free path, set `RENDER_MODE=client` and redeploy — the
container scales to zero and stops billing.

## Local test of just the renderer
```bash
cd containers/recap-render
docker build -t vantage-recap .
docker run -p 8080:8080 -e RENDER_SECRET=dev vantage-recap
curl -s -X POST localhost:8080/render -H 'x-render-secret: dev' \
  -H 'content-type: application/json' \
  -d '{"width":1280,"height":720,"msPerFrame":1600,"frames":[{"url":"https://picsum.photos/1280/720","displayName":"a"},{"url":"https://picsum.photos/1281/720","displayName":"b"}]}' \
  --output recap.mp4
```
