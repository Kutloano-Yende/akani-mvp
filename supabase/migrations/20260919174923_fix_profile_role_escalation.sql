-- The "profiles updatable by self" RLS policy only restricts which ROW a
-- user can touch (their own), not which COLUMNS. Without this, any signed-in
-- user could run `update profiles set role = 'admin' where id = auth.uid()`
-- and self-promote, since Supabase grants table-wide UPDATE to the
-- `authenticated` role by default and RLS was the only backstop.
--
-- Fix: drop the table-wide UPDATE grant for self-service roles and re-grant
-- only the columns a user should be able to change themselves. Role changes
-- must go through the service-role key from an admin-only server action.
revoke update on public.profiles from authenticated, anon;
grant update (name) on public.profiles to authenticated;
