#!/usr/bin/env bash
# Removes the local test stack. Add --volumes-too to also delete the Postgres container.
cd "$(dirname "$0")/../../.."
source supabase/tenancy/harness/env.sh
docker rm -f "$TEN_AUTH" "$TEN_REST" "$TEN_MAIL" >/dev/null 2>&1
[ "${1:-}" = "--volumes-too" ] && docker rm -f "$TEN_PG" >/dev/null 2>&1 && docker network rm "$TEN_NET" >/dev/null 2>&1
echo "stopped"
