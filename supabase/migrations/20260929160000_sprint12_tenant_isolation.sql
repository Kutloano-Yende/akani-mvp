-- Sprint 12 / Phase 2 of multi-tenancy: real RLS isolation.
--
-- Phase 1 (20260927100000_sprint9_tenancy_foundation.sql) added tenant_id to 9
-- tables but deliberately left every RLS policy unchanged -- confirmed against
-- production (pg_policies) just now: every one of those tables is still fully
-- open to any authenticated user, or gated only by role, never by tenant. This
-- migration is what actually turns tenant_id into isolation.
--
-- Also fixes a second confirmed gap: handle_new_user() and the invite route
-- both leave a new profile's tenant_id null. A self-signup or an invited user
-- got no tenant at all until now.
--
-- Also reverses the sprint11 "audit logs: platform admins only" instruction --
-- the user now wants tenant admins to see their own tenant's audit rows too,
-- alongside (not instead of) the existing platform-admin sees-everything policy.
--
-- Deliberately NOT done here (separate future phases): tenant_id on the other
-- 10 tables (opportunity_signals, api_usage, email_templates, applications,
-- conversions, popia_requests, booking_settings, leads, lead_emails, bookings),
-- the Super Admin UI, tenant CRUD, tenant switching, and an automated
-- cross-tenant test suite. Verified instead via rolled-back transactions
-- against production (see the plan this migration was written from).

-- ---------------------------------------------------------------------------
-- handle_new_user(): assign tenant_id on signup
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role, tenant_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    'sales',
    coalesce(
      (new.raw_user_meta_data->>'tenant_id')::uuid,
      '11111111-1111-4111-8111-111111111111'
    )
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

drop policy "companies readable by authenticated" on companies;
create policy "companies readable within tenant" on companies
  for select to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

drop policy "companies writable by authenticated" on companies;
create policy "companies writable within tenant" on companies
  for insert to authenticated with check (tenant_id = current_tenant_id());

drop policy "companies updatable by authenticated" on companies;
create policy "companies updatable within tenant" on companies
  for update to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------

drop policy "contacts readable by authenticated" on contacts;
create policy "contacts readable within tenant" on contacts
  for select to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

drop policy "contacts writable by authenticated" on contacts;
create policy "contacts writable within tenant" on contacts
  for insert to authenticated with check (tenant_id = current_tenant_id());

drop policy "contacts updatable by authenticated" on contacts;
create policy "contacts updatable within tenant" on contacts
  for update to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

-- ---------------------------------------------------------------------------
-- prospects (ownership logic preserved, just tenant-scoped in addition)
-- ---------------------------------------------------------------------------

drop policy "prospects readable by authenticated" on prospects;
create policy "prospects readable within tenant" on prospects
  for select to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

drop policy "prospects insertable by owner or manager" on prospects;
create policy "prospects insertable within tenant" on prospects
  for insert to authenticated with check (
    tenant_id = current_tenant_id()
    and (assigned_to is null or assigned_to = auth.uid() or current_user_role() = any(array['admin','manager']::user_role[]))
  );

drop policy "prospects updatable by owner or manager" on prospects;
create policy "prospects updatable within tenant" on prospects
  for update to authenticated using (
    tenant_id = current_tenant_id()
    and (assigned_to is null or assigned_to = auth.uid() or current_user_role() = any(array['admin','manager']::user_role[]))
  );

-- ---------------------------------------------------------------------------
-- activities (no UPDATE policy exists today -- unchanged)
-- ---------------------------------------------------------------------------

drop policy "activities readable by authenticated" on activities;
create policy "activities readable within tenant" on activities
  for select to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

drop policy "activities writable by authenticated" on activities;
create policy "activities writable within tenant" on activities
  for insert to authenticated with check (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------

drop policy "campaigns readable by authenticated" on campaigns;
create policy "campaigns readable within tenant" on campaigns
  for select to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

drop policy "campaigns insertable by managers" on campaigns;
create policy "campaigns insertable within tenant" on campaigns
  for insert to authenticated with check (
    tenant_id = current_tenant_id() and current_user_role() = any(array['admin','manager']::user_role[])
  );

drop policy "campaigns updatable by managers" on campaigns;
create policy "campaigns updatable within tenant" on campaigns
  for update to authenticated using (
    tenant_id = current_tenant_id() and current_user_role() = any(array['admin','manager']::user_role[])
  );

-- ---------------------------------------------------------------------------
-- campaign_prospects
-- ---------------------------------------------------------------------------

drop policy "campaign_prospects readable by authenticated" on campaign_prospects;
create policy "campaign_prospects readable within tenant" on campaign_prospects
  for select to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

drop policy "campaign_prospects insertable by managers" on campaign_prospects;
create policy "campaign_prospects insertable within tenant" on campaign_prospects
  for insert to authenticated with check (
    tenant_id = current_tenant_id() and current_user_role() = any(array['admin','manager']::user_role[])
  );

drop policy "campaign_prospects updatable by managers" on campaign_prospects;
create policy "campaign_prospects updatable within tenant" on campaign_prospects
  for update to authenticated using (
    tenant_id = current_tenant_id() and current_user_role() = any(array['admin','manager']::user_role[])
  );

-- ---------------------------------------------------------------------------
-- suppression_list (admin-only today, project-wide; add tenant scope)
-- Known limitation carried forward: the lower(email)/phone uniqueness indexes
-- stay GLOBAL, not per-tenant (Phase 1 author's note, a deliberate Phase 3
-- decision, not fixed here). A tenant can't see another tenant's suppression
-- row after this change, but can still fail to insert a duplicate of one.
-- ---------------------------------------------------------------------------

drop policy "suppression list readable by admins" on suppression_list;
create policy "suppression list readable within tenant" on suppression_list
  for select to authenticated using (
    current_user_role() = 'admin' and (tenant_id = current_tenant_id() or is_platform_admin())
  );

drop policy "suppression list writable by admins" on suppression_list;
create policy "suppression list writable within tenant" on suppression_list
  for insert to authenticated with check (current_user_role() = 'admin' and tenant_id = current_tenant_id());

drop policy "suppression list deletable by admins" on suppression_list;
create policy "suppression list deletable within tenant" on suppression_list
  for delete to authenticated using (
    current_user_role() = 'admin' and (tenant_id = current_tenant_id() or is_platform_admin())
  );

-- ---------------------------------------------------------------------------
-- profiles (SELECT only -- UPDATE stays "self", already column-grant-
-- restricted: authenticated has no UPDATE grant on role or tenant_id)
-- ---------------------------------------------------------------------------

drop policy "profiles readable by authenticated" on profiles;
create policy "profiles readable within tenant" on profiles
  for select to authenticated using (tenant_id = current_tenant_id() or is_platform_admin() or id = auth.uid());

-- ---------------------------------------------------------------------------
-- audit_logs: add tenant-admin visibility alongside platform-admin
-- ---------------------------------------------------------------------------

create policy "audit logs readable within tenant" on audit_logs
  for select to authenticated using (
    current_user_role() = 'admin' and tenant_id = current_tenant_id()
  );
-- "audit logs readable by platform admins" (is_platform_admin()) is untouched
-- -- two SELECT policies OR together, so platform admin keeps seeing everything.
