-- Turned out insufficient on its own — see the next migration. Revoking
-- from PUBLIC does not revoke privileges Supabase's default-privileges
-- setup grants directly to anon/authenticated, independent of PUBLIC.
revoke execute on function public.set_audit_user_id() from public;
