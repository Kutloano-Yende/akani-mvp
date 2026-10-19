-- Tender Intelligence (Phase 1): a GLOBAL, read-only catalog of South
-- African government tenders synced from National Treasury's eTenders /
-- OCDS Transparency Portal, plus a TENANT-SCOPED table for saving, assigning
-- and annotating tenders. Design rationale and every claim referenced below
-- (e.g. "sprint23 OSM lesson") were verified against this repo's own
-- migration history before writing this file -- see the approved plan.
--
-- NOT applied to production as part of this change -- local file only,
-- pending explicit approval.

-- ===========================================================================
-- tenders: GLOBAL reference data, no tenant_id. One row per OCDS ocid,
-- shared read-only across every tenant on the platform (confirmed decision --
-- tenders are public-domain SA government data, not tenant-owned; all
-- tenant-specific curation lives in saved_tenders below).
--
-- Unlike every other table in this schema, this one is a DELIBERATE global
-- table, not an accidental pre-tenancy leftover like email_templates/
-- opportunity_signals -- stated explicitly via its single, named RLS policy.
-- ===========================================================================

create table tenders (
  id uuid primary key default gen_random_uuid(),

  -- Unique GLOBALLY, not per-tenant -- the inverse of the sprint23 fix
  -- (20261007201420_sprint23_osm_provider_tenant_unique.sql), which narrowed
  -- companies' external-id uniqueness to per-tenant after two tenants
  -- searching the same OSM business collided on the same external id. Here
  -- there is no tenant_id column to scope by, and there's supposed to be
  -- exactly one row per real-world tender platform-wide -- scoping this per
  -- tenant would recreate a different version of that same bug.
  ocid text not null,
  release_id text not null,
  tender_number text,

  title text not null,
  description text,

  -- Deliberately unconstrained text, not a Postgres enum: this is
  -- externally-sourced data from a public-beta government API (confirmed via
  -- live testing to be unreliable -- see the sync module) whose documented
  -- status vocabulary (planning/active/complete/cancelled/unsuccessful/
  -- withdrawn) might not be the complete real-world set. An enum would make
  -- an unanticipated value a hard sync failure instead of just an unfiltered
  -- row.
  status text not null,

  -- Same reasoning as status -- goods/works/services/consultingServices is
  -- the documented OCDS set, but ~24% of real sampled records had none at
  -- all (empty string in the source, normalized to NULL here, never '').
  main_procurement_category text,

  buyer_id text,
  buyer_name text,

  -- Best-effort ONLY. Verified directly against a real 690-release sample:
  -- buyer is always exactly {id, name}, party addresses are always just
  -- {countryName: "South Africa"} -- there is no real province/region field
  -- anywhere in the source data. This is derived by regex against known
  -- province-name prefixes in buyer_name (src/lib/tenders/province-guess.ts)
  -- and must never be presented as authoritative -- always nullable, with an
  -- explicit "Unknown" bucket in the UI rather than a guessed default.
  province_guess text,

  tender_period_start timestamptz,
  tender_period_end timestamptz,

  -- Verified: almost always 0 for a pre-award tender (value only becomes
  -- real once an award exists, by which point the tender is closed) --
  -- deliberately NOT indexed or used for sorting/filtering in V1.
  value_amount numeric,
  value_currency text,

  documents jsonb not null default '[]'::jsonb,
  -- The official source link -- required by the PDDL license's attribution
  -- term and by the portal's own "verify before relying on this" caveat.
  source_url text,

  published_date timestamptz not null,
  -- Full OCDS release, kept so reprocessing (e.g. a future normalizer fix)
  -- never needs a re-fetch of already-synced data.
  raw jsonb not null,

  search_vector tsvector generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(buyer_name, '')
    )
  ) stored,

  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenders_ocid_key unique (ocid)
);

create index tenders_status_idx on tenders (status);
create index tenders_category_idx on tenders (main_procurement_category);
create index tenders_closing_idx on tenders (tender_period_end);
create index tenders_province_guess_idx on tenders (province_guess);
create index tenders_search_vector_idx on tenders using gin (search_vector);

create trigger tenders_set_updated_at before update on tenders
  for each row execute function set_updated_at();

alter table tenders enable row level security;

create policy "tenders readable by authenticated" on tenders
  for select to authenticated using (true);

-- No insert/update/delete policy for `authenticated` at all -- same lockdown
-- shape as tenants/platform_admins (RLS-enabled, zero write policies for the
-- authenticated role). The sync job writes through createAdminClient()
-- (service role, bypasses RLS entirely), the same tool already used by
-- src/app/api/admin/tenants/route.ts for its own RLS-locked insert into
-- `tenants`.
revoke insert, update, delete, truncate, trigger, references on tenders from anon, authenticated;


-- ===========================================================================
-- saved_tenders: tenant-scoped. Save + assign + a single current-state note
-- folded into one row -- same shape as prospects.assigned_to /
-- prospects.lost_reason_note (confirmed decision: no separate notes/
-- assignment tables, matching the user's own "don't create unnecessary
-- tables" instruction).
-- ===========================================================================

create table saved_tenders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  tender_id uuid not null references tenders(id) on delete cascade,

  saved_by uuid not null,
  assigned_to uuid,

  notes text,

  -- The TENANT's own pipeline state for this tender, independent of
  -- tenders.status (the official OCDS status). text + check, matching the
  -- existing convention for app-controlled status columns (e.g. tenants.status,
  -- popia_requests.status, leads.status) rather than every status column
  -- being a Postgres enum.
  status text not null default 'saved'
    check (status in ('saved', 'in_progress', 'submitted', 'won', 'lost', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saved_tenders_tenant_id_id_key unique (tenant_id, id),
  constraint saved_tenders_tenant_tender_key unique (tenant_id, tender_id),

  -- Composite FKs so saved_by/assigned_to can never resolve to a different
  -- tenant's profile -- the same mechanism as prospects_tenant_assignee_fk /
  -- act_tenant_user_fk etc. introduced in sprint9
  -- (20260927101630_sprint9_tenancy_foundation.sql), defined directly here
  -- since this is a new table, not a retrofit.
  constraint saved_tenders_tenant_saved_by_fk
    foreign key (tenant_id, saved_by) references profiles (tenant_id, id),
  constraint saved_tenders_tenant_assignee_fk
    foreign key (tenant_id, assigned_to) references profiles (tenant_id, id)
);

create index saved_tenders_tenant_id_idx on saved_tenders (tenant_id);
create index saved_tenders_tender_id_idx on saved_tenders (tender_id);
create index saved_tenders_assigned_to_idx on saved_tenders (tenant_id, assigned_to);

alter table saved_tenders enable row level security;

-- Policy phrasing follows the CURRENT project convention
-- ((select fn()) rather than a bare fn() call), established in
-- 20261002095612_sprint19_rls_performance.sql to let Postgres's planner
-- cache each function call once per query instead of once per row. Note:
-- sprint24/25/26's own new policies did NOT follow this (they used the
-- older bare-call form) -- this migration deliberately uses the
-- better-performing form sprint19 itself established as the intended
-- standard, flagged explicitly in the implementation report rather than
-- silently diverging from what shipped most recently.
create policy "saved_tenders readable within tenant" on saved_tenders
  for select to authenticated
  using (tenant_id = (select current_tenant_id()) or (select is_platform_admin()));

create policy "saved_tenders insertable within tenant" on saved_tenders
  for insert to authenticated
  with check (tenant_id = (select current_tenant_id()));

-- Ownership-aware update, same shape as the prospects policy
-- (20261002095612_sprint19_rls_performance.sql's "prospects updatable within
-- tenant"): a sales user can only touch their own/unassigned save,
-- admin/manager can touch any within the tenant.
create policy "saved_tenders updatable within tenant" on saved_tenders
  for update to authenticated
  using (
    tenant_id = (select current_tenant_id())
    and (
      assigned_to is null
      or assigned_to = (select auth.uid())
      or (select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role])
    )
  );

-- "Unsave" = delete the bookmark row (not a soft hide) -- same
-- ownership-aware shape as update, so a sales rep can unsave their own save
-- but not someone else's; admin/manager can unsave any within the tenant.
create policy "saved_tenders deletable within tenant" on saved_tenders
  for delete to authenticated
  using (
    tenant_id = (select current_tenant_id())
    and (
      saved_by = (select auth.uid())
      or (select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role])
    )
  );

create trigger saved_tenders_set_tenant before insert on saved_tenders
  for each row execute function set_tenant_id();
create trigger saved_tenders_set_updated_at before update on saved_tenders
  for each row execute function set_updated_at();

revoke truncate, trigger, references on saved_tenders from anon, authenticated;
