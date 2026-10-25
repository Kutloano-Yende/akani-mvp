-- Tender Award Signals: derived, GLOBAL data extracted from `tenders.raw`
-- at sync time -- the name of the winning supplier and the award value for
-- any tender whose OCDS release includes award data (confirmed live: ~4% of
-- a real sample month, and NOT correlated with `tenders.status`). Kept as
-- its own indexed table rather than querying `tenders.raw` ad hoc, so the
-- Opportunities list can filter/sort by "has an award" / award value
-- without re-parsing jsonb on every request.
--
-- CRITICAL DATA QUALITY NOTE, confirmed across every real award sample
-- inspected: the OCDS "supplier" party's `contactPoint` (email/phone/contact
-- name) is the BUYER's own procurement officer, not the winning company's --
-- e.g. a release whose supplier is "VODACOM" carries contactPoint email
-- "tshepom@ceta.co.za", the buyer CETA's domain, not Vodacom's. This table
-- deliberately has NO contact columns at all -- only name and award value,
-- the two fields independently verifiable as belonging to the supplier.
-- Never add a contact field here by copying the party's contactPoint.
--
-- NOT applied to production as part of this change -- local file only,
-- pending explicit approval.

create table tender_awards (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references tenders(id) on delete cascade,

  -- OCDS award.id -- unique per award within a release, not globally.
  award_id text not null,

  -- The only two fields confirmed to actually belong to the winning
  -- supplier (see note above). No registration number/identifier exists in
  -- the source data either -- SupplierID is always 0 in every real sample,
  -- so there is no reliable key to auto-match this name against `companies`.
  supplier_name text not null,
  value_amount numeric,
  value_currency text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A single award can in principle have more than one supplier (a joint
  -- venture) -- every real sample had exactly one, but suppliers is an
  -- array in the source schema, so the constraint allows for it rather than
  -- assuming 1:1.
  constraint tender_awards_tender_award_supplier_key unique (tender_id, award_id, supplier_name)
);

create index tender_awards_tender_id_idx on tender_awards (tender_id);
create index tender_awards_value_amount_idx on tender_awards (value_amount);

create trigger tender_awards_set_updated_at before update on tender_awards
  for each row execute function set_updated_at();

alter table tender_awards enable row level security;

-- Same lockdown shape as `tenders` -- global, derived reference data, zero
-- write policies for `authenticated`. Written only by syncTenders() via
-- createAdminClient() (service role), in the same sync pass as `tenders`.
create policy "tender_awards readable by authenticated" on tender_awards
  for select to authenticated using (true);

revoke insert, update, delete, truncate, trigger, references on tender_awards from anon, authenticated;
