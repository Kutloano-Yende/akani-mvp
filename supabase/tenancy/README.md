# Multi-tenancy Phase 0/1 verification harness

Local-only Docker stack (Postgres 17.6 + GoTrue + PostgREST + Mailpit, the same
images Supabase itself uses) used to rehearse and verify every multi-tenancy
migration against a production-equivalent schema before it touches production.
Nothing here talks to production; it never has.

- `harness/` — `up.sh` / `reset.sh` / `down.sh` bring the local stack up, reset
  the throwaway test database from a baseline built from `supabase/migrations/`,
  and tear it down. `lib.mjs` is the shared test helper (real signup/login,
  real PostgREST calls, raw SQL as the table owner).
- `experiments/` — Phase 0's five standalone experiments (enum rename,
  composite FKs, PostgREST embedding, metadata/signup exposure, getClaims).
- `drafts/` — the Phase 0 proof-of-concept tenancy schema (superseded by the
  real migration once it's written; kept for reference).
- `matrix/run.mjs` — the two-tenant, six-persona isolation matrix, meant to be
  run again once Phase 3 swaps RLS.
- `matrix/phase1_verify.mjs` — what Phase 1 actually claims: existing app
  flows are unaffected, tenant_id is server-assigned and tamper-proof,
  cross-tenant FK links are already rejected, a suspended tenant is already
  inert, and cross-tenant SELECT is still (expectedly) open until Phase 3.

Bring the stack up with `bash harness/up.sh`, reset it with `bash
harness/reset.sh`, remove it entirely with `bash harness/down.sh
--volumes-too`.
