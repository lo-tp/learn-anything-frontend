#!/usr/bin/env bash
# Set up the development database:
#   1. starts the dev Postgres if it is not already up (podman/docker compose)
#   2. creates the learn_anything database (if missing)
#   3. applies db/schema.sql + db/seed.sql idempotently
#
# Safe to re-run at any time; it never drops or truncates existing data.
source "$(dirname "$0")/db-common.sh"
cd "$(dirname "$0")/.."

ensure_db_up

if [ -z "$(psql_admin -Atc "SELECT 1 FROM pg_database WHERE datname = 'learn_anything'")" ]; then
  psql_admin -c "CREATE DATABASE learn_anything"
fi

psql_admin -f db/schema.sql
psql_admin -f db/seed.sql
echo "dev db ready: postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/learn_anything"
