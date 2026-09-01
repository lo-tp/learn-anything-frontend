#!/usr/bin/env bash
# Recreate the test database from scratch:
#   drop + create learn_anything_test, then apply the schema from
#   db/schema.ts via drizzle-kit push (no seed — tests insert what they need).
#
# Re-running WIPES the test database. Requires node_modules (drizzle-kit).
# Running this while tests are connected will fail (or kill their
# connections); run it before tests start.
source "$(dirname "$0")/db-common.sh"
cd "$(dirname "$0")/.."

ensure_db_up

psql_meta -c "DROP DATABASE IF EXISTS learn_anything_test"
psql_meta -c "CREATE DATABASE learn_anything_test"

export DATABASE_URL="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/learn_anything_test"
if ! npx drizzle-kit push --force; then
  echo "error: drizzle-kit push failed (schema drift needs a look)" >&2
  exit 1
fi
echo "test db ready: postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/learn_anything_test"
