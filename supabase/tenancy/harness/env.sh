# Local-only test stack settings. Nothing here is a real secret and none of it
# can reach production: the stack runs in Docker on 127.0.0.1.
export TEN_NET=akani-tenancy-net
export TEN_PG=akani-tenancy-pg
export TEN_AUTH=akani-tenancy-auth
export TEN_REST=akani-tenancy-rest
export TEN_DB=akani_test                 # throwaway copy, recreated by reset.sh
export TEN_BASELINE_DB=postgres          # production-equivalent schema; never modified after up.sh
export TEN_PW=localtest
export TEN_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
export TEN_PG_IMAGE=public.ecr.aws/supabase/postgres:17.6.1.158
export TEN_AUTH_IMAGE=public.ecr.aws/supabase/gotrue:v2.195.0
export TEN_REST_IMAGE=public.ecr.aws/supabase/postgrest:v14.16
export TEN_AUTH_URL=http://127.0.0.1:54331
export TEN_REST_URL=http://127.0.0.1:54330
psql_in() { docker exec -i "$TEN_PG" psql -U supabase_admin -h localhost -v ON_ERROR_STOP=1 -q "$@"; }
export TEN_MAIL=akani-tenancy-mail
export TEN_MAIL_IMAGE=public.ecr.aws/supabase/mailpit:v1.30.2
export TEN_MAIL_URL=http://127.0.0.1:54332
# Set TEN_DISABLE_SIGNUP=true before reset.sh to mimic Auth with public sign-up switched off.
export TEN_DISABLE_SIGNUP="${TEN_DISABLE_SIGNUP:-false}"
