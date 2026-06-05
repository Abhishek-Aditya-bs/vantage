/**
 * D1 schema (Drizzle) — a lightweight GLOBAL registry of spaces. The live
 * per-space state lives in each space's Durable Object; D1 exists so a Cron
 * Trigger can enumerate and expire old spaces (you can't list Durable Objects).
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const spaces = sqliteTable("spaces", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  hostMemberId: text("host_member_id").notNull(),
  createdAt: integer("created_at").notNull(),
  lastActiveAt: integer("last_active_at").notNull(),
  status: text("status").notNull().default("active"),
});

export type SpaceRow = typeof spaces.$inferSelect;
