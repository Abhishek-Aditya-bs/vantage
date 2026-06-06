# Vantage recap renderer — Node + ffmpeg, for the Phase-2 server render path.
# Build context is this directory. Cloudflare builds this image when RENDER_MODE=server
# and the `containers` block in wrangler.jsonc is enabled (needs the Workers Paid plan).
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json server.mjs ./

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
