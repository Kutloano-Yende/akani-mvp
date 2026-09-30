-- Sprint 17: getTenantAppearance() was two sequential round trips (an RPC
-- to resolve tenant_id, then a separate select) on every Dashboard/
-- Analytics/Data Provider/Super Admin Overview page load -- a real,
-- reported latency cost. One combined SECURITY DEFINER RPC, same pattern
-- as current_tenant_id(), cuts that to one round trip.
create or replace function current_tenant_appearance()
returns table (allow_custom_branding boolean, chart_style text, layout_style text)
  language sql stable security definer set search_path = public as $$
  select t.allow_custom_branding, t.chart_style, t.layout_style
  from profiles p
  join tenants t on t.id = p.tenant_id
  where p.id = auth.uid() and t.status = 'active'
$$;
