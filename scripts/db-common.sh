# Shared helpers for the db scripts (sourced, not executed).
set -euo pipefail

# Prefer docker if its daemon is actually running, otherwise podman.
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
else
  compose() { podman compose "$@"; }
fi

DB_HOST=localhost
DB_PORT=5434
DB_USER=learn_anything
export PGPASSWORD=learn_anything

# Ensure the dev Postgres is up and accepting connections.
ensure_db_up() {
  compose up -d db
  local i
  for i in $(seq 1 60); do
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d learn_anything \
      -c 'SELECT 1' >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done
  echo "error: Postgres did not become ready on ${DB_HOST}:${DB_PORT}" >&2
  compose logs db >&2
  exit 1
}

psql_admin() { # psql as the db user against the default admin db
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d learn_anything -v ON_ERROR_STOP=1 "$@"
}
