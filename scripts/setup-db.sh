#!/usr/bin/env bash
# Recreate a Learn Anything Postgres database from scratch.
#
# Usage:
#   scripts/setup-db.sh <db-url> [--seed]
#
# Dev:
#   scripts/setup-db.sh postgresql://learn_anything:learn_anything@localhost:5434/learn_anything --seed
# Test:
#   scripts/setup-db.sh postgresql://learn_anything:learn_anything@localhost:5434/learn_anything_test
#
# Drops + creates the target database, applies the schema from db/schema.ts
# via `drizzle-kit push --force`, and (with --seed) applies db/seed.sql.
# Re-running WIPES the target database — dev data is disposable pre-MVP.
#
# Requires: node_modules installed (drizzle-kit), psql, and the compose
# Postgres service up on the url's host:port (this script runs
# `compose up -d db` itself if needed). A running app's pooled connections
# to the target db block the drop — stop it first.
set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
  echo "usage: scripts/setup-db.sh postgresql://user:password@host:port/dbname [--seed]" >&2
}

DB_URL="${1:-}"
if [ -z "$DB_URL" ]; then
  usage
  exit 1
fi
shift

SEED=0
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=1 ;;
    *) echo "error: unknown argument '$arg'" >&2; usage; exit 1 ;;
  esac
done

if [[ ! "$DB_URL" =~ ^postgresql://([^:]+):([^@/]+)@([^.[:space:]]+):([0-9]+)/([^/?]+)$ ]]; then
  echo "error: expected postgresql://user:password@host:port/dbname" >&2
  exit 1
fi
DB_USER="${BASH_REMATCH[1]}"
DB_PASS="${BASH_REMATCH[2]}"
DB_HOST="${BASH_REMATCH[3]}"
DB_PORT="${BASH_REMATCH[4]}"
DB_NAME="${BASH_REMATCH[5]}"

if [[ ! "$DB_NAME" =~ ^[a-z0-9_]+$ ]]; then
  echo "error: invalid database name '${DB_NAME}'" >&2
  exit 1
fi
export PGPASSWORD="$DB_PASS"

psql_db() { # psql against the target db
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}
psql_meta() { # psql against the always-present `postgres` db
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 "$@"
}

# Ensure the compose Postgres is up and accepting connections.
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
else
  compose() { podman compose "$@"; }
fi
compose up -d db

ready=0
for i in $(seq 1 60); do
  if psql_meta -c 'SELECT 1' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "error: Postgres did not become ready on ${DB_HOST}:${DB_PORT}" >&2
  compose logs db >&2
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
