import { defineConfig } from "drizzle-kit";

// Used only to GENERATE SQL migrations from worker/db/schema.ts.
// Migrations are applied to D1 via `wrangler d1 migrations apply vantage`.
export default defineConfig({
  schema: "./worker/db/schema.ts",
  out: "./worker/db/migrations",
  dialect: "sqlite",
});
