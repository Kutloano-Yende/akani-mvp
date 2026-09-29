-- Sprint 13: Super Admin UI needs to actually read the tenants table.
-- Phase 1 left `tenants` RLS-enabled with zero policies on purpose
-- ("nothing in the app reads this table yet"). Now something does.
create policy "tenants readable by platform admins" on tenants
  for select to authenticated using (is_platform_admin());
