import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit is used only for schema inspection/mirroring
 * (`npx drizzle-kit pull`). Migrations are NOT generated here —
 * `db/schema.sql` is the canonical DDL, applied by scripts/*.sh.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  out: "./.drizzle",
  verbose: true,
  strict: true,
});
