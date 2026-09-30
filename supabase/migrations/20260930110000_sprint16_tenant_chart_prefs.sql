-- Sprint 16: tenant-customizable chart style (bar/line) and page layout
-- (grid/grouped), gated by the same allow_custom_branding permission as
-- colors/logo. Nullable, no default -- null means "no preference, keep
-- each component's own current default" so an unbranded tenant's pages
-- are byte-for-byte identical to today.
alter table tenants add column chart_style text check (chart_style in ('bar', 'line'));
alter table tenants add column layout_style text check (layout_style in ('grid', 'grouped'));
