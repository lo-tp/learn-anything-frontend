import { defineConfig } from "drizzle-kit";

/**
 * `db/schema.ts` is the canonical schema (ADR 0005). scripts/setup-db.sh
 * applies it with `drizzle-kit push --force` against its url argument;
 * `npx drizzle-kit pull` remains handy for inspecting a live db's drift.
 * No drizzle-kit migrations are generated in this repo.
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
