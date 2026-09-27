-- Sprint 9 / Phase 1 of multi-tenancy: foundation only.
--
-- Adds tenants, platform_admins, tenant_id on the core tables, backfills every
-- existing record to the Akani tenant, adds composite (tenant_id, id) foreign
-- keys so a row can never reference another tenant's parent, and a
-- SECURITY INVOKER trigger that makes the server (not the client) assign
-- tenant_id on every insert made through an authenticated session.
--
-- Deliberately NOT done here (later phases): the existing RLS policies are
-- UNCHANGED -- they still read `true` for any authenticated user, so this
-- migration adds no isolation between tenants yet and the app keeps working
-- exactly as before. tenant_id on the remaining tables (applications,
-- conversions, popia_requests, leads, lead_emails, bookings,
-- booking_settings, api_usage, email_templates), the RLS swap, the Super
-- Admin UI and tenant email settings are all separate, later phases.
--
-- Rehearsed against a local production-equivalent replica before running
-- here; see supabase/tenancy/ for the harness and verification scripts.

-- ---------------------------------------------------------------------------
-- Platform tables
-- ---------------------------------------------------------------------------

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  suspended_at timestamptz
);
alter table tenants enable row level security;
-- No policies yet: RLS on with zero policies denies anon/authenticated
-- entirely. Nothing in the app reads this table yet. SECURITY DEFINER
-- helper functions below bypass RLS to read it safely.
revoke truncate, trigger, references on tenants from anon, authenticated;

create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table platform_admins enable row level security;
-- Same as tenants: locked down, nothing populated yet. Deciding who goes in
-- here is a deliberate later step, not part of this migration.
revoke truncate, trigger, references on platform_admins from anon, authenticated;

insert into tenants (id, name, slug)
  values ('11111111-1111-4111-8111-111111111111', 'Akani BEE Ratings', 'akani');

-- ---------------------------------------------------------------------------
-- tenant_id columns: add nullable, backfill, then enforce NOT NULL
-- (Helper functions and triggers that reference profiles.tenant_id/
-- companies.tenant_id/etc. are defined further below, after these columns
-- exist.)
-- ---------------------------------------------------------------------------

alter table profiles add column tenant_id uuid references tenants(id);
update profiles set tenant_id = '11111111-1111-4111-8111-111111111111';
-- profiles.tenant_id stays NULLABLE: null means "platform admin", enforced
-- by the trigger below instead of a NOT NULL constraint.
alter table profiles add constraint profiles_tenant_id_id_key unique (tenant_id, id);

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
-- The existing global-uniqueness suppression indexes (lower(email), phone)
-- are LEFT AS-IS in this phase. Making them per-tenant is a Phase 3
-- isolation decision (the plan you approved: suppression is tenant-specific),
-- not a Phase 1 structural change.

alter table audit_logs add column tenant_id uuid references tenants(id);
update audit_logs set tenant_id = '11111111-1111-4111-8111-111111111111';
-- audit_logs.tenant_id stays NULLABLE: a future platform-level event (e.g.
-- tenant_created) has no tenant. Every existing row is tenant-scoped today,
-- so all 51 are correctly backfilled to Akani above.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER is required here: it must read profiles/tenants
-- regardless of the caller's own row-level access (that's the whole point --
-- it's how a caller finds out their OWN tenant before any tenant-scoped
-- policy could apply). Returns null for a user with no tenant, or whose
-- tenant is suspended, so every future policy that uses it fails closed.
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

-- Phase 0 finding: this MUST be SECURITY INVOKER. Inside a SECURITY DEFINER
-- function, current_user reflects the function's OWNER, not the caller, so a
-- current_user check there would always see the owner and silently trust
-- whatever tenant_id the client sent -- defeating the point of this trigger.
-- As SECURITY INVOKER, current_user correctly reflects the role PostgREST
-- switched to for this request ('authenticated', 'anon', or 'service_role').
-- It still safely calls current_tenant_id() (which stays SECURITY DEFINER,
-- since it legitimately needs to read across the caller's own RLS).
create or replace function set_tenant_id() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then
    -- service-role / direct-connection writes (server-side imports, the
    -- leads cron, migrations) bypass RLS already and are trusted to supply
    -- tenant_id themselves, the same way they already bypass RLS today.
    if new.tenant_id is null then
      raise exception 'tenant_id must be supplied explicitly outside an authenticated session';
    end if;
    return new;
  end if;
  new.tenant_id := current_tenant_id();
  if new.tenant_id is null then
    raise exception 'no active tenant for current user';
  end if;
  return new;
end;
$$;

-- Runs only on UPDATE OF tenant_id, not INSERT: handle_new_user() inserts a
-- profile with tenant_id still null (unchanged in this phase), and the
-- invite/user-management route is expected to set it in a follow-up
-- statement (closing that gap is Phase 5's job). Checking on INSERT here
-- would make every signup fail before that follow-up runs.
create or replace function profiles_require_tenant_or_platform() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null and not exists (select 1 from platform_admins where user_id = new.id) then
    raise exception 'profile % has no tenant and is not a platform admin', new.id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Composite (tenant_id, x) foreign keys, replacing the single-column ones
-- ---------------------------------------------------------------------------

alter table prospects drop constraint prospects_company_id_fkey;
alter table prospects add constraint prospects_tenant_company_fk
  foreign key (tenant_id, company_id) references companies (tenant_id, id) on delete cascade;

alter table prospects drop constraint prospects_assigned_to_fkey;
alter table prospects add constraint prospects_tenant_assignee_fk
  foreign key (tenant_id, assigned_to) references profiles (tenant_id, id);

alter table contacts drop constraint contacts_company_id_fkey;
alter table contacts add constraint contacts_tenant_company_fk
  foreign key (tenant_id, company_id) references companies (tenant_id, id) on delete cascade;

alter table campaign_prospects drop constraint campaign_prospects_prospect_id_fkey;
alter table campaign_prospects add constraint cp_tenant_prospect_fk
  foreign key (tenant_id, prospect_id) references prospects (tenant_id, id) on delete cascade;

alter table campaign_prospects drop constraint campaign_prospects_campaign_id_fkey;
alter table campaign_prospects add constraint cp_tenant_campaign_fk
  foreign key (tenant_id, campaign_id) references campaigns (tenant_id, id) on delete cascade;

alter table activities drop constraint activities_prospect_id_fkey;
alter table activities add constraint act_tenant_prospect_fk
  foreign key (tenant_id, prospect_id) references prospects (tenant_id, id) on delete cascade;

alter table activities drop constraint activities_user_id_fkey;
alter table activities add constraint act_tenant_user_fk
  foreign key (tenant_id, user_id) references profiles (tenant_id, id);

alter table audit_logs drop constraint audit_logs_user_id_fkey;
alter table audit_logs add constraint audit_tenant_user_fk
  foreign key (tenant_id, user_id) references profiles (tenant_id, id);

alter table campaigns drop constraint campaigns_created_by_fkey;
alter table campaigns add constraint campaigns_tenant_creator_fk
  foreign key (tenant_id, created_by) references profiles (tenant_id, id);

alter table suppression_list drop constraint suppression_list_created_by_fkey;
alter table suppression_list add constraint suppression_tenant_creator_fk
  foreign key (tenant_id, created_by) references profiles (tenant_id, id);

-- ---------------------------------------------------------------------------
-- Tenant-assignment triggers (server, not client, decides tenant_id)
-- ---------------------------------------------------------------------------

create trigger companies_set_tenant before insert on companies for each row execute function set_tenant_id();
create trigger contacts_set_tenant before insert on contacts for each row execute function set_tenant_id();
create trigger prospects_set_tenant before insert on prospects for each row execute function set_tenant_id();
create trigger activities_set_tenant before insert on activities for each row execute function set_tenant_id();
create trigger campaigns_set_tenant before insert on campaigns for each row execute function set_tenant_id();
create trigger campaign_prospects_set_tenant before insert on campaign_prospects for each row execute function set_tenant_id();
create trigger suppression_list_set_tenant before insert on suppression_list for each row execute function set_tenant_id();

create trigger profiles_tenant_or_platform_check
  after update of tenant_id on profiles
  for each row execute function profiles_require_tenant_or_platform();

-- ---------------------------------------------------------------------------
-- Indexes and grant hygiene
-- ---------------------------------------------------------------------------

create index companies_tenant_id_idx on companies (tenant_id);
create index contacts_tenant_id_idx on contacts (tenant_id);
create index prospects_tenant_id_idx on prospects (tenant_id);
create index activities_tenant_id_idx on activities (tenant_id);
create index campaigns_tenant_id_idx on campaigns (tenant_id);
create index campaign_prospects_tenant_id_idx on campaign_prospects (tenant_id);
create index suppression_list_tenant_id_idx on suppression_list (tenant_id);
create index audit_logs_tenant_id_idx on audit_logs (tenant_id);
create index profiles_tenant_id_idx on profiles (tenant_id);

revoke truncate, trigger, references on
  profiles, companies, contacts, prospects, activities, campaigns,
  campaign_prospects, suppression_list, audit_logs
  from anon, authenticated;
