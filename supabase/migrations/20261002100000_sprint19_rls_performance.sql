-- Performance fix, no behavior change: every RLS policy in this database
-- calls current_tenant_id()/is_platform_admin()/current_user_role()/auth.uid()
-- directly in its qual/with_check. Postgres's planner can't cache a directly
-- referenced function call across rows, so each gets re-evaluated once per
-- row scanned instead of once per query (confirmed via Supabase's own
-- performance advisor, auth_rls_initplan, WARN level). Wrapping each call as
-- (select fn()) lets the planner hoist it into an InitPlan, computed once.
-- Also merges audit_logs' and tenants' two permissive SELECT policies into
-- one each (multiple_permissive_policies, also WARN) -- Postgres evaluates
-- every permissive policy on a table for every query, so two policies where
-- one would do is pure waste. Every condition below is logically identical
-- to what it replaces; this changes nothing about who can see or do what.

alter policy "activities writable within tenant" on activities
  with check (tenant_id = (select current_tenant_id()));
alter policy "activities readable within tenant" on activities
  using (tenant_id = (select current_tenant_id()) or (select is_platform_admin()));

-- audit_logs: merge the two SELECT policies into one.
drop policy "audit logs readable by platform admins" on audit_logs;
alter policy "audit logs readable within tenant" on audit_logs
  using (
    (select is_platform_admin())
    or ((select current_user_role()) = 'admin'::user_role and tenant_id = (select current_tenant_id()))
  );

alter policy "booking settings updatable by managers" on booking_settings
  using ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]))
  with check ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]));

alter policy "campaign_prospects insertable within tenant" on campaign_prospects
  with check (
    tenant_id = (select current_tenant_id())
    and (select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role])
  );
alter policy "campaign_prospects readable within tenant" on campaign_prospects
  using (tenant_id = (select current_tenant_id()) or (select is_platform_admin()));
alter policy "campaign_prospects updatable within tenant" on campaign_prospects
  using (
    tenant_id = (select current_tenant_id())
    and (select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role])
  );

alter policy "campaigns insertable within tenant" on campaigns
  with check (
    tenant_id = (select current_tenant_id())
    and (select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role])
  );
alter policy "campaigns readable within tenant" on campaigns
  using (tenant_id = (select current_tenant_id()) or (select is_platform_admin()));
alter policy "campaigns updatable within tenant" on campaigns
  using (
    tenant_id = (select current_tenant_id())
    and (select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role])
  );

alter policy "companies writable within tenant" on companies
  with check (tenant_id = (select current_tenant_id()));
alter policy "companies readable within tenant" on companies
  using (tenant_id = (select current_tenant_id()) or (select is_platform_admin()));
alter policy "companies updatable within tenant" on companies
  using (tenant_id = (select current_tenant_id()) or (select is_platform_admin()));

alter policy "contacts writable within tenant" on contacts
  with check (tenant_id = (select current_tenant_id()));
alter policy "contacts readable within tenant" on contacts
  using (tenant_id = (select current_tenant_id()) or (select is_platform_admin()));
alter policy "contacts updatable within tenant" on contacts
  using (tenant_id = (select current_tenant_id()) or (select is_platform_admin()));

alter policy "leads updatable by managers" on leads
  using ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]))
  with check ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]));

alter policy "platform_admins readable by platform admins" on platform_admins
  using ((select is_platform_admin()));

alter policy "popia requests insertable by admins" on popia_requests
  with check ((select current_user_role()) = 'admin'::user_role);
alter policy "popia requests readable by admins" on popia_requests
  using ((select current_user_role()) = 'admin'::user_role);
alter policy "popia requests updatable by admins" on popia_requests
  using ((select current_user_role()) = 'admin'::user_role);

alter policy "profiles readable within tenant" on profiles
  using (
    tenant_id = (select current_tenant_id())
    or (select is_platform_admin())
    or id = (select auth.uid())
  );
alter policy "profiles updatable by self" on profiles
  using (id = (select auth.uid()));

alter policy "prospects insertable within tenant" on prospects
  with check (
    tenant_id = (select current_tenant_id())
    and (
      assigned_to is null
      or assigned_to = (select auth.uid())
      or (select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role])
    )
  );
alter policy "prospects readable within tenant" on prospects
  using (tenant_id = (select current_tenant_id()) or (select is_platform_admin()));
alter policy "prospects updatable within tenant" on prospects
  using (
    tenant_id = (select current_tenant_id())
    and (
      assigned_to is null
      or assigned_to = (select auth.uid())
      or (select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role])
    )
  );

alter policy "suppression list deletable within tenant" on suppression_list
  using (
    (select current_user_role()) = 'admin'::user_role
    and (tenant_id = (select current_tenant_id()) or (select is_platform_admin()))
  );
alter policy "suppression list writable within tenant" on suppression_list
  with check (
    (select current_user_role()) = 'admin'::user_role and tenant_id = (select current_tenant_id())
  );
alter policy "suppression list readable within tenant" on suppression_list
  using (
    (select current_user_role()) = 'admin'::user_role
    and (tenant_id = (select current_tenant_id()) or (select is_platform_admin()))
  );

-- tenants: merge the two SELECT policies into one.
drop policy "tenants readable by platform admins" on tenants;
alter policy "tenants readable by own members" on tenants
  using (id = (select current_tenant_id()) or (select is_platform_admin()));
