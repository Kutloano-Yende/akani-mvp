-- api_usage was never tenant-scoped: its only RLS policy is
-- `using (true)` -- any authenticated user, from any tenant, can read every
-- tenant's search/enrichment usage and credit counts. Both /analytics and
-- /settings/data-provider aggregate this table directly, so this is a live
-- cross-tenant data leak of the same class the `leads` table had before
-- sprint24 closed it. Closing it the same way: add tenant_id, backfill,
-- scope the RLS policy, and -- unlike leads (populated from a public,
-- unauthenticated intake path) -- attach the standard set_tenant_id()
-- trigger, since every api_usage insert already happens through an
-- authenticated application route.

alter table api_usage add column tenant_id uuid references tenants(id);

update api_usage set tenant_id = '11111111-1111-4111-8111-111111111111';

alter table api_usage alter column tenant_id set not null;

create index api_usage_tenant_id_idx on api_usage (tenant_id);

create trigger api_usage_set_tenant before insert on api_usage
  for each row execute function set_tenant_id();

drop policy "api usage readable by authenticated" on api_usage;
create policy "api usage readable within tenant" on api_usage
  for select to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

drop policy "api usage writable by authenticated" on api_usage;
create policy "api usage writable within tenant" on api_usage
  for insert to authenticated with check (tenant_id = current_tenant_id());
