/**
 * Vantage recap renderer — the Phase-2 server-side render service.
 *
 * A tiny dependency-free HTTP server (Node built-ins + the `ffmpeg` CLI) that
 * runs inside a Cloudflare Container. It accepts a recap manifest, downloads the
 * frame images, and renders a 720p MP4 slideshow with Ken-Burns zoom + crossfade
 * transitions, then streams the bytes back.
 *
 * Contract (called by worker/render.ts via the RecapRenderer container DO):
 *   POST /render
 *     headers: X-Render-Secret: <RENDER_SECRET>            (optional, if configured)
 *     body:   { title, width, height, msPerFrame, frames: [{ url, displayName }] }
 *   200 -> video/mp4 (the rendered recap)
 *   GET /health -> 200 "ok"
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.RENDER_SECRET || "";
const FPS = 30;
const XFADE = 0.6; // seconds of crossfade between stills
const MAX_FRAMES = 60; // bound render time / memory

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }
    if (req.method !== "POST" || req.url !== "/render") {
      res.writeHead(404).end("not found");
      return;
    }
    if (SECRET && req.headers["x-render-secret"] !== SECRET) {
      res.writeHead(401).end("unauthorized");
      return;
    }

    const manifest = JSON.parse(await readBody(req));
    const mp4 = await render(manifest);
    res.writeHead(200, { "content-type": "video/mp4", "content-length": mp4.length });
    res.end(mp4);
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }));
  }
});

server.listen(PORT, () => console.log(`recap-render listening on :${PORT}`));

/* ------------------------------------------------------------------ helpers */

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function render(manifest) {
  const W = manifest.width || 1080;
  const H = manifest.height || 1920;
  const frameSec = Math.max(0.6, (manifest.msPerFrame || 1600) / 1000);
  const frames = (manifest.frames || []).slice(0, MAX_FRAMES);
  if (frames.length === 0) throw new Error("no frames");

  const dir = await mkdtemp(join(tmpdir(), "recap-"));
  try {
    // 1) download frames
    const paths = [];
    for (let i = 0; i < frames.length; i++) {
      const r = await fetch(frames[i].url);
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const p = join(dir, `in_${String(i).padStart(3, "0")}`);
      await writeFile(p, buf);
      paths.push(p);
    }
    if (paths.length === 0) throw new Error("no frames downloaded");

    // 2) build ffmpeg args
    const out = join(dir, "out.mp4");
    const args = ["-y"];
    for (const p of paths) args.push("-loop", "1", "-t", String(frameSec), "-i", p);
    args.push("-filter_complex", buildFilter(paths.length, W, H, frameSec));
    // High-quality H.264 (well below the visible-artifact threshold), web-streamable.
    args.push(
      "-map", "[v]", "-r", String(FPS),
      "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
    );

    await run("ffmpeg", args);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * A Ken-Burns slide per image — a blurred, darkened cover backdrop (so vertical
 * 9:16 output is always full-bleed, never tiny) with the photo contained on top,
 * chained together with crossfades. Mirrors the on-device client renderer.
 */
function buildFilter(n, W, H, frameSec) {
  const d = Math.round(frameSec * FPS); // zoompan frames per still
  const seg = [];
  for (let i = 0; i < n; i++) {
    seg.push(
      `[${i}:v]split=2[bg${i}][fg${i}];` +
        `[bg${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
        `boxblur=24:2,eq=brightness=-0.28,setsar=1[bgb${i}];` +
        `[fg${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fgb${i}];` +
        `[bgb${i}][fgb${i}]overlay=(W-w)/2:(H-h)/2,` +
        `zoompan=z='min(zoom+0.0009,1.10)':d=${d}:s=${W}x${H}:fps=${FPS},` +
        `format=yuv420p[v${i}]`,
    );
  }
  if (n === 1) return `${seg[0].replace("[v0]", "[v]")}`;

  // crossfade chain with accumulating offsets
  const chain = [];
  let prev = `v0`;
  let running = frameSec;
  for (let i = 1; i < n; i++) {
    const offset = (running - XFADE).toFixed(3);
    const label = i === n - 1 ? "v" : `x${i}`;
    chain.push(`[${prev}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset}[${label}]`);
    prev = label;
    running = running + frameSec - XFADE;
  }
  return [...seg, ...chain].join(";");
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-800)}`))));
  });
}
