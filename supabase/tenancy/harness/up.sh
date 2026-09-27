#!/usr/bin/env bash
# Starts the local test stack: Postgres (same image family as Supabase), GoTrue
# (Supabase Auth) and PostgREST (the API layer), and builds the throwaway test
# database from the production-equivalent baseline. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/../../.."
source supabase/tenancy/harness/env.sh

docker network inspect "$TEN_NET" >/dev/null 2>&1 || docker network create "$TEN_NET" >/dev/null

if ! docker ps -a --format '{{.Names}}' | grep -qx "$TEN_PG"; then
  docker run -d --name "$TEN_PG" --network "$TEN_NET" -e POSTGRES_PASSWORD="$TEN_PW" \
    -p 127.0.0.1:54329:5432 "$TEN_PG_IMAGE" >/dev/null
fi
docker start "$TEN_PG" >/dev/null 2>&1 || true
docker network connect "$TEN_NET" "$TEN_PG" >/dev/null 2>&1 || true
for i in $(seq 1 60); do docker exec "$TEN_PG" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 2; done

# The image doesn't set passwords for its service roles; Auth and the API log in as these.
psql_in -d template1 -c "alter role authenticator with password '$TEN_PW'" -c "alter role supabase_auth_admin with password '$TEN_PW'"

# Baseline = the repo's migrations applied to the image's default database.
if [ "$(psql_in -d "$TEN_BASELINE_DB" -Atc "select to_regclass('public.prospects') is not null")" != "t" ]; then
  echo "Applying repo migrations to the baseline database..."
  for f in supabase/migrations/*.sql; do psql_in -d "$TEN_BASELINE_DB" < "$f"; done
fi

bash supabase/tenancy/harness/reset.sh
