-- Sprint 15: tenant branding (custom colors + logo), gated by a permission
-- only the platform super admin can grant.
alter table tenants add column allow_custom_branding boolean not null default false;
alter table tenants add column brand_primary_color text;
alter table tenants add column brand_accent_color text;
alter table tenants add column brand_logo_url text;

alter table tenants add constraint brand_primary_color_hex
  check (brand_primary_color is null or brand_primary_color ~* '^#[0-9a-f]{6}$');
alter table tenants add constraint brand_accent_color_hex
  check (brand_accent_color is null or brand_accent_color ~* '^#[0-9a-f]{6}$');

-- Fixes a real bug found while building this: (app)/layout.tsx's suspended-
-- tenant check reads profiles.tenants(status) via a nested select, but
-- tenants had only ONE SELECT policy (is_platform_admin()) -- for any
-- non-platform-admin user that nested join was silently blocked by RLS, so
-- the suspended redirect never actually fired for them. This also lets
-- tenant members read their own tenant's branding columns.
create policy "tenants readable by own members" on tenants
  for select to authenticated using (id = current_tenant_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-logos', 'tenant-logos', true, 3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

create policy "tenant logos are publicly readable" on storage.objects
  for select using (bucket_id = 'tenant-logos');
