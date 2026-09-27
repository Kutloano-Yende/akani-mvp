#!/usr/bin/env bash
# Recreates the throwaway test database from the baseline and (re)starts Auth and
# the API against it. Run before every experiment or matrix run.
set -euo pipefail
cd "$(dirname "$0")/../../.."
source supabase/tenancy/harness/env.sh

docker rm -f "$TEN_AUTH" "$TEN_REST" "$TEN_MAIL" >/dev/null 2>&1 || true
psql_in -d template1 -c "select pg_terminate_backend(pid) from pg_stat_activity where datname in ('$TEN_DB','$TEN_BASELINE_DB') and pid <> pg_backend_pid()" >/dev/null
psql_in -d template1 -c "drop database if exists $TEN_DB" -c "create database $TEN_DB template $TEN_BASELINE_DB"

docker run -d --name "$TEN_MAIL" --network "$TEN_NET" -p 127.0.0.1:54332:8025 "$TEN_MAIL_IMAGE" >/dev/null
docker run -d --name "$TEN_AUTH" --network "$TEN_NET" -p 127.0.0.1:54331:9999 \
  -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL="$TEN_AUTH_URL" \
  -e GOTRUE_DB_DRIVER=postgres \
  -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:$TEN_PW@$TEN_PG:5432/$TEN_DB" \
  -e GOTRUE_SITE_URL=http://localhost:3000 -e GOTRUE_JWT_SECRET="$TEN_JWT_SECRET" -e GOTRUE_JWT_EXP=3600 \
  -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  -e GOTRUE_DISABLE_SIGNUP="$TEN_DISABLE_SIGNUP" -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=false \
  -e GOTRUE_SMTP_HOST="$TEN_MAIL" -e GOTRUE_SMTP_PORT=1025 -e GOTRUE_SMTP_ADMIN_EMAIL=noreply@test.local \
  -e GOTRUE_SMTP_USER=x -e GOTRUE_SMTP_PASS=x \
  "$TEN_AUTH_IMAGE" >/dev/null
docker run -d --name "$TEN_REST" --network "$TEN_NET" -p 127.0.0.1:54330:3000 \
  -e PGRST_DB_URI="postgres://authenticator:$TEN_PW@$TEN_PG:5432/$TEN_DB" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$TEN_JWT_SECRET" \
  "$TEN_REST_IMAGE" >/dev/null

for i in $(seq 1 40); do
  curl -fs "$TEN_AUTH_URL/health" >/dev/null 2>&1 && curl -fs -o /dev/null "$TEN_REST_URL/" 2>&1 && curl -fs -o /dev/null "$TEN_MAIL_URL/api/v1/messages" 2>&1 && { echo "stack ready ($TEN_DB)"; exit 0; }
  sleep 2
done
echo "stack did not become ready"; docker logs --tail 15 "$TEN_AUTH"; docker logs --tail 15 "$TEN_REST"; exit 1
