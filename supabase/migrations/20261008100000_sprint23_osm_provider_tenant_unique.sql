-- The (external_id, source) uniqueness constraint predates multi-tenancy
-- (20260919171700_sprint1_core_schema.sql) and was never revisited when
-- tenant_id was added (20260927100000_sprint9_tenancy_foundation.sql).
-- This was latent while every provider's IDs were opaque per-account
-- values (Lusha, CompanyData), but OpenStreetMap node/way IDs are
-- globally stable public identifiers -- two different tenants searching
-- the same real South African business via OSM get the SAME externalId.
-- Tenant B's RLS-scoped duplicate checks only see Tenant B's own rows, so
-- they'd pass, then the insert would hit this global constraint because
-- Tenant A's (invisible) row already holds that pair.
--
-- Confirmed via rolled-back SQL transactions against production: before
-- this migration, two tenants inserting the same (external_id, source)
-- pair collide; after it, each gets their own row, and a duplicate within
-- the same tenant is still correctly rejected.
alter table companies drop constraint companies_external_id_source_key;
alter table companies add constraint companies_tenant_id_external_id_source_key
  unique (tenant_id, external_id, source);
