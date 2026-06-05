import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

// Full-stack Cloudflare app: React SPA (client) + Hono Worker + Durable Objects,
// built & dev-served together by the Cloudflare Vite plugin. Tailwind v4 via its
// dedicated Vite plugin. (PWA plugin is added later, once the core is verified.)
export default defineConfig({
  plugins: [react(), cloudflare(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
});
