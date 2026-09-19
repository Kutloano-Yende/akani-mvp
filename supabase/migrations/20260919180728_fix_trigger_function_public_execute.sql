-- Postgres grants EXECUTE to PUBLIC by default when a function is created.
-- The earlier "revoke ... from anon, authenticated" (20260919171713) was a
-- no-op in practice: PUBLIC's grant still applies to every role,
-- anon/authenticated included. Revoke from PUBLIC directly — these are
-- trigger-only functions, nothing should call them via RPC.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.set_updated_at() from public;
