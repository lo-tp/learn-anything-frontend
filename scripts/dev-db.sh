#!/usr/bin/env bash
# Rebuild the development database from scratch:
#   1. starts the dev Postgres if it is not already up (podman/docker compose)
#   2. drops + creates the learn_anything database
#   3. applies the schema from db/schema.ts (drizzle-kit push)
#   4. applies db/seed.sql
#
# Re-running WIPES the dev database (all rows) — dev data is disposable;
# this keeps the dev db a clean, reproducible function of db/schema.ts +
# db/seed.sql. Stop any running app (its pooled connections block the drop).
# Requires node_modules installed (drizzle-kit).
source "$(dirname "$0")/db-common.sh"
cd "$(dirname "$0")/.."

ensure_db_up

psql_meta -c "DROP DATABASE IF EXISTS learn_anything"
psql_meta -c "CREATE DATABASE learn_anything"

export DATABASE_URL="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/learn_anything"
if ! npx drizzle-kit push --force; then
  echo "error: drizzle-kit push failed (schema drift needs a look)" >&2
  exit 1
fi

psql_admin -f db/seed.sql
echo "dev db ready: postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/learn_anything"
