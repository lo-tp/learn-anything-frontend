# The canonical schema is `db/schema.ts`; SQL DDL is retired

`db/schema.ts` (Drizzle) is the single canonical schema. The former `db/schema.sql` is deleted, and the db scripts apply the TS schema with `drizzle-kit push --force` (dev: `scripts/dev-db.sh`; test: `scripts/test-db.sh`). Only `db/seed.sql` remains as SQL.

**Why:** `core/store` queries through Drizzle, so the TS schema is already the file the code depends on. Keeping a second hand-written SQL DDL as the "real" artifact meant two sources of truth that had to be kept in sync by hand; the TS schema plus `drizzle-kit push` is one source, applied by the same toolchain that types the queries. The scripts recreate the databases from scratch on every run (drop + push + seed) rather than migrating: dev data is disposable pre-MVP, and a from-scratch apply keeps `drizzle-kit push` on its cleanest path (no live-diff prompts, no drift to reconcile).

**Considered options:** keeping `db/schema.sql` canonical with `db/schema.ts` as a verified mirror (rejected: two artifacts, manual sync); drizzle-kit migrations (`generate` + `migrate`, rejected: a migrations directory and versioning machinery this local-only, pre-MVP-discardable-database setup does not need — `push` syncs the dev/test DBs directly).

**Consequences:**

- **Both db scripts wipe their database on every run** (`DROP DATABASE` + push + seed for dev; drop + push for test). Re-running `scripts/dev-db.sh` resets dev data to seed state — deliberate, and why no migration path exists. A running app's pooled connections block the drop; stop it first.
- `drizzle-kit push --force` runs against a fresh database (clean create path; `--force` guards against any data-loss statement the diff might propose).
- The db scripts now require `node_modules` installed (plus `psql`/podman as before).
- `db/seed.sql` is applied after the push, unchanged.
- Map #11 originally pinned `db/schema.sql` as binding spec; this decision supersedes that line for schema authoring (`docs/schema.md` keeps the shape rationale and now points at `db/schema.ts`).
