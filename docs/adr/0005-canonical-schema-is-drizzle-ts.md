# The canonical schema is `db/schema.ts`; SQL DDL is retired

`db/schema.ts` (Drizzle) is the single canonical schema. The former `db/schema.sql` is deleted, and `scripts/setup-db.sh <dev|test>` recreates either database — drop + create, apply the TS schema with `drizzle-kit push --force`, and seed (dev only). Only `db/seed.sql` remains as SQL.

**Why:** `core/store` queries through Drizzle, so the TS schema is already the file the code depends on. Keeping a second hand-written SQL DDL as the "real" artifact meant two sources of truth that had to be kept in sync by hand; the TS schema plus `drizzle-kit push` is one source, applied by the same toolchain that types the queries. The script recreates the database from scratch on every run (drop + push, + seed for dev) rather than migrating: dev data is disposable pre-MVP, and a from-scratch apply keeps `drizzle-kit push` on its cleanest path (no live-diff prompts, no drift to reconcile). One script (`scripts/setup-db.sh <dev|test>`) sets up either database.

**Considered options:** keeping `db/schema.sql` canonical with `db/schema.ts` as a verified mirror (rejected: two artifacts, manual sync); drizzle-kit migrations (`generate` + `migrate`, rejected: a migrations directory and versioning machinery this local-only, pre-MVP-discardable-database setup does not need — `push` syncs the dev/test DBs directly).

**Consequences:**

- **`setup-db.sh` wipes its target database on every run** (`DROP DATABASE` + push; dev is seeded, test is not). Re-running the dev setup resets dev data to seed state — deliberate, and why no migration path exists. A running app's pooled connections block the drop; stop it first.
- `drizzle-kit push --force` runs against a fresh database (clean create path; `--force` guards against any data-loss statement the diff might propose).
- The script now requires `node_modules` installed (plus `psql`/podman as before).
- `db/seed.sql` is applied after the push for `dev` (never for `test`), unchanged.
- Map #11 originally pinned `db/schema.sql` as binding spec; this decision supersedes that line for schema authoring (`docs/schema.md` keeps the shape rationale and now points at `db/schema.ts`).
