#!/usr/bin/env bash
# Rebuild a Learn Anything Postgres database from scratch.
#
# Usage:
#   scripts/setup-db.sh dev    # learn_anything — schema + seed
#   scripts/setup-db.sh test   # learn_anything_test — schema only (tests insert their own fixtures)
#
# Drops + creates the target database, applies the schema from db/schema.ts
# via `drizzle-kit push --force`, and (for dev) applies db/seed.sql.
# Re-running WIPES the target database — dev data is disposable pre-MVP.
#
# Requires: node_modules installed (drizzle-kit), psql, and the compose
# Postgres service ALREADY RUNNING on the target's host:port
# (`podman compose up -d db`) — this script does not start it. A running
# app's pooled connections to the target db block the drop — stop it first.
set -euo pipefail
cd "$(dirname "$0")/.."

usage() { echo "usage: scripts/setup-db.sh <dev|test>" >&2; }

TARGET="${1:-}"
case "${TARGET,,}" in
  dev)  DB_NAME="learn_anything"; SEED=1 ;;
  test) DB_NAME="learn_anything_test"; SEED=0 ;;
  *)
    echo "error: unknown target '${TARGET:-}'" >&2
    usage
    exit 1
    ;;
esac

# Compose Postgres service defaults (see docker-compose.yml).
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5434}"
DB_USER="${DB_USER:-learn_anything}"
DB_PASS="${DB_PASS:-learn_anything}"
export PGPASSWORD="$DB_PASS"

DB_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

psql_db() { # psql against the target db
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}
psql_meta() { # psql against the always-present `postgres` db
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 "$@"
}

# The compose Postgres service must already be running; fail fast if not.
if ! PGCONNECT_TIMEOUT=3 psql_meta -c 'SELECT 1' >/dev/null 2>&1; then
  echo "error: Postgres is not reachable at ${DB_HOST}:${DB_PORT}." >&2
  echo "Start it first: podman compose up -d db" >&2
  exit 1
fi

psql_meta -c "DROP DATABASE IF EXISTS ${DB_NAME}"
psql_meta -c "CREATE DATABASE ${DB_NAME}"

if ! DATABASE_URL="$DB_URL" npx drizzle-kit push --force; then
  echo "error: drizzle-kit push failed (schema drift needs a look)" >&2
  exit 1
fi

if [ "$SEED" = 1 ]; then
  psql_db -f db/seed.sql
fi

echo "db ready: ${DB_URL}"
