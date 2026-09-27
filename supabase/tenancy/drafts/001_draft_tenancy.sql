-- DRAFT for Phase 0 testing only. Not applied to production. Applies the
-- target multi-tenant model to the throwaway database so the RLS matrix can
-- run against real policies instead of a plan on paper.
begin;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- seed + backfill (mirrors the real Phase 1 migration order: additive, then backfill, then enforce)
insert into tenants (id, name, slug) values ('11111111-1111-4111-8111-111111111111', 'Akani BEE Ratings', 'akani');

-- profiles: tenant_id, nullable only for platform admins
alter table profiles add column tenant_id uuid references tenants(id);
update profiles set tenant_id = '11111111-1111-4111-8111-111111111111';
alter table profiles add constraint profiles_tenant_id_id_key unique (tenant_id, id);
-- (subqueries aren't allowed in CHECK; enforced instead by a trigger below)

create or replace function profiles_require_tenant_or_platform() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null and not exists (select 1 from platform_admins where user_id = new.id) then
    raise exception 'profile % has no tenant and is not a platform admin', new.id;
  end if;
  return new;
end;
$$;
-- Fires after UPDATE only: handle_new_user() inserts a profile with tenant_id
-- still null, and the invite route is expected to set it in a follow-up
-- statement within the same request (see Phase 0 finding). Checking on INSERT
-- would make every signup fail before that follow-up runs.
create trigger profiles_tenant_or_platform_check
  after update of tenant_id on profiles
  for each row execute function profiles_require_tenant_or_platform();

create or replace function current_tenant_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select p.tenant_id from profiles p
    join tenants t on t.id = p.tenant_id
    where p.id = auth.uid() and t.status = 'active'
$$;
create or replace function is_platform_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;

-- tenant_id on every tenant-owned table
alter table companies add column tenant_id uuid references tenants(id);
update companies set tenant_id = '11111111-1111-4111-8111-111111111111';
alter table companies alter column tenant_id set not null;
alter table companies add constraint companies_tenant_id_id_key unique (tenant_id, id);
alter table contacts add column tenant_id uuid references tenants(id);
update contacts set tenant_id = '11111111-1111-4111-8111-111111111111';
alter table contacts alter column tenant_id set not null;
alter table prospects add column tenant_id uuid references tenants(id);
update prospects set tenant_id = '11111111-1111-4111-8111-111111111111';
alter table prospects alter column tenant_id set not null;
alter table prospects add constraint prospects_tenant_id_id_key unique (tenant_id, id);
alter table activities add column tenant_id uuid references tenants(id);
update activities set tenant_id = '11111111-1111-4111-8111-111111111111';
alter table activities alter column tenant_id set not null;
alter table campaigns add column tenant_id uuid references tenants(id);
update campaigns set tenant_id = '11111111-1111-4111-8111-111111111111';
alter table campaigns alter column tenant_id set not null;
alter table campaigns add constraint campaigns_tenant_id_id_key unique (tenant_id, id);
alter table campaign_prospects add column tenant_id uuid references tenants(id);
update campaign_prospects set tenant_id = '11111111-1111-4111-8111-111111111111';
alter table campaign_prospects alter column tenant_id set not null;
alter table suppression_list add column tenant_id uuid references tenants(id);
update suppression_list set tenant_id = '11111111-1111-4111-8111-111111111111';
alter table suppression_list alter column tenant_id set not null;
alter table audit_logs add column tenant_id uuid references tenants(id); -- null = platform event

-- composite FKs (replace single-column ones so PostgREST embeds stay unambiguous)
alter table prospects drop constraint prospects_company_id_fkey;
alter table prospects add constraint prospects_tenant_company_fk foreign key (tenant_id, company_id) references companies (tenant_id, id) on delete cascade;
alter table prospects drop constraint prospects_assigned_to_fkey;
alter table prospects add constraint prospects_tenant_assignee_fk foreign key (tenant_id, assigned_to) references profiles (tenant_id, id);
alter table contacts drop constraint contacts_company_id_fkey;
alter table contacts add constraint contacts_tenant_company_fk foreign key (tenant_id, company_id) references companies (tenant_id, id) on delete cascade;
alter table campaign_prospects drop constraint campaign_prospects_prospect_id_fkey;
alter table campaign_prospects add constraint cp_tenant_prospect_fk foreign key (tenant_id, prospect_id) references prospects (tenant_id, id) on delete cascade;
alter table campaign_prospects drop constraint campaign_prospects_campaign_id_fkey;
alter table campaign_prospects add constraint cp_tenant_campaign_fk foreign key (tenant_id, campaign_id) references campaigns (tenant_id, id) on delete cascade;
alter table activities drop constraint activities_prospect_id_fkey;
alter table activities add constraint act_tenant_prospect_fk foreign key (tenant_id, prospect_id) references prospects (tenant_id, id) on delete cascade;

-- server assigns tenant_id; client value is ignored
-- IMPORTANT (Phase 0 finding): this must be SECURITY INVOKER, not DEFINER.
-- Inside a SECURITY DEFINER function, current_user reflects the function's
-- OWNER, not the actual caller -- so checking current_user there would always
-- see the owner and silently trust whatever tenant_id the client sent,
-- defeating the whole point of this trigger. As SECURITY INVOKER, current_user
-- correctly reflects the role PostgREST switched to for this request
-- ('authenticated', 'anon', or 'service_role'). It can still call
-- current_tenant_id() (which stays SECURITY DEFINER, since IT legitimately
-- needs to read profiles/tenants regardless of the caller's own RLS).
create or replace function set_tenant_id() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then
    if new.tenant_id is null then
      raise exception 'tenant_id must be supplied explicitly outside an authenticated session';
    end if;
    return new;
  end if;
  new.tenant_id := current_tenant_id();
  if new.tenant_id is null then raise exception 'no active tenant for current user'; end if;
  return new;
end;
$$;
create trigger companies_set_tenant before insert on companies for each row execute function set_tenant_id();
create trigger contacts_set_tenant before insert on contacts for each row execute function set_tenant_id();
create trigger prospects_set_tenant before insert on prospects for each row execute function set_tenant_id();
create trigger activities_set_tenant before insert on activities for each row execute function set_tenant_id();
create trigger campaigns_set_tenant before insert on campaigns for each row execute function set_tenant_id();
create trigger campaign_prospects_set_tenant before insert on campaign_prospects for each row execute function set_tenant_id();
create trigger suppression_list_set_tenant before insert on suppression_list for each row execute function set_tenant_id();

-- swap RLS: replace `true`/role-only policies with tenant-scoped ones
drop policy "companies readable by authenticated" on companies;
drop policy "companies writable by authenticated" on companies;
drop policy "companies updatable by authenticated" on companies;
create policy "companies: tenant read" on companies for select to authenticated using (tenant_id = current_tenant_id());
create policy "companies: tenant write" on companies for insert to authenticated with check (tenant_id = current_tenant_id());
create policy "companies: tenant update" on companies for update to authenticated using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

drop policy "contacts readable by authenticated" on contacts;
drop policy "contacts writable by authenticated" on contacts;
drop policy "contacts updatable by authenticated" on contacts;
create policy "contacts: tenant read" on contacts for select to authenticated using (tenant_id = current_tenant_id());
create policy "contacts: tenant write" on contacts for insert to authenticated with check (tenant_id = current_tenant_id());
create policy "contacts: tenant update" on contacts for update to authenticated using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

drop policy "prospects readable by authenticated" on prospects;
drop policy "prospects insertable by owner or manager" on prospects;
drop policy "prospects updatable by owner or manager" on prospects;
create policy "prospects: tenant read" on prospects for select to authenticated using (tenant_id = current_tenant_id());
create policy "prospects: tenant write" on prospects for insert to authenticated with check (
  tenant_id = current_tenant_id() and (assigned_to is null or assigned_to = auth.uid() or current_user_role() = any (array['admin'::user_role,'manager'::user_role])));
create policy "prospects: tenant update" on prospects for update to authenticated
  using (tenant_id = current_tenant_id() and (assigned_to is null or assigned_to = auth.uid() or current_user_role() = any (array['admin'::user_role,'manager'::user_role])))
  with check (tenant_id = current_tenant_id() and (assigned_to is null or assigned_to = auth.uid() or current_user_role() = any (array['admin'::user_role,'manager'::user_role])));

drop policy "activities readable by authenticated" on activities;
drop policy "activities writable by authenticated" on activities;
create policy "activities: tenant read" on activities for select to authenticated using (tenant_id = current_tenant_id());
create policy "activities: tenant write" on activities for insert to authenticated with check (tenant_id = current_tenant_id());

drop policy "campaigns readable by authenticated" on campaigns;
drop policy "campaigns insertable by managers" on campaigns;
drop policy "campaigns updatable by managers" on campaigns;
create policy "campaigns: tenant read" on campaigns for select to authenticated using (tenant_id = current_tenant_id());
create policy "campaigns: tenant write" on campaigns for insert to authenticated with check (tenant_id = current_tenant_id() and current_user_role() = any (array['admin'::user_role,'manager'::user_role]));
create policy "campaigns: tenant update" on campaigns for update to authenticated using (tenant_id = current_tenant_id() and current_user_role() = any (array['admin'::user_role,'manager'::user_role]));

drop policy "campaign_prospects readable by authenticated" on campaign_prospects;
drop policy "campaign_prospects insertable by managers" on campaign_prospects;
drop policy "campaign_prospects updatable by managers" on campaign_prospects;
create policy "cp: tenant read" on campaign_prospects for select to authenticated using (tenant_id = current_tenant_id());
create policy "cp: tenant write" on campaign_prospects for insert to authenticated with check (tenant_id = current_tenant_id() and current_user_role() = any (array['admin'::user_role,'manager'::user_role]));
create policy "cp: tenant update" on campaign_prospects for update to authenticated using (tenant_id = current_tenant_id() and current_user_role() = any (array['admin'::user_role,'manager'::user_role]));

drop policy "suppression list readable by admins" on suppression_list;
drop policy "suppression list writable by admins" on suppression_list;
drop policy "suppression list deletable by admins" on suppression_list;
create policy "supp: tenant read" on suppression_list for select to authenticated using (tenant_id = current_tenant_id() and current_user_role() = 'admin'::user_role);
create policy "supp: tenant write" on suppression_list for insert to authenticated with check (tenant_id = current_tenant_id() and current_user_role() = 'admin'::user_role);
create policy "supp: tenant delete" on suppression_list for delete to authenticated using (tenant_id = current_tenant_id() and current_user_role() = 'admin'::user_role);

drop policy "profiles readable by authenticated" on profiles;
create policy "profiles: tenant read" on profiles for select to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

drop policy "audit logs readable by admins" on audit_logs;
create policy "audit: tenant read" on audit_logs for select to authenticated using (tenant_id = current_tenant_id() and current_user_role() = 'admin'::user_role);
drop policy "audit logs insertable by authenticated" on audit_logs;
create policy "audit: tenant write" on audit_logs for insert to authenticated with check (tenant_id is not distinct from current_tenant_id());

commit;
