-- Mirrors current_tenant_id()'s existing "t.status = 'active'" guard
-- (20260927100000_sprint9_tenancy_foundation.sql), which is the REAL
-- enforcement for a suspended tenant -- /account-suspended is just a
-- clearer redirect than letting every page look silently empty. Without
-- this, a suspended user's RLS access wouldn't actually be revoked at the
-- DB layer, only blocked by middleware -- this closes that gap the same
-- way tenant suspension already does.
create or replace function current_tenant_id()
returns uuid as $$
  select p.tenant_id from profiles p
    join tenants t on t.id = p.tenant_id
    where p.id = auth.uid() and t.status = 'active' and p.status = 'active'
$$ language sql stable security definer set search_path = public;

create or replace function is_platform_admin()
returns boolean as $$
  select exists (
    select 1 from platform_admins pa
    join profiles p on p.id = pa.user_id
    where pa.user_id = auth.uid() and p.status = 'active'
  )
$$ language sql stable security definer set search_path = public;
