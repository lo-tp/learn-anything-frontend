#!/usr/bin/env bash
# Recreate the test database from scratch:
#   drop + create learn_anything_test, then apply db/schema.sql (no seed —
#   tests insert what they need).
#
# Running this while tests are connected will fail (or kill their
# connections); run it before tests start.
source "$(dirname "$0")/db-common.sh"
cd "$(dirname "$0")/.."

ensure_db_up

psql_admin -c "DROP DATABASE IF EXISTS learn_anything_test"
psql_admin -c "CREATE DATABASE learn_anything_test"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d learn_anything_test \
  -v ON_ERROR_STOP=1 -f db/schema.sql
echo "test db ready: postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/learn_anything_test"
