-- In-app feedback: any signed-in user can submit a short message from the
-- feedback button in the app shell. Stored here as the durable record (so
-- nothing is lost if email isn't configured) and best-effort emailed to
-- SUPPORT_EMAIL by the API route.
create table feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  submitted_by uuid not null references profiles(id),
  message text not null,
  page_path text,
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index feedback_tenant_id_idx on feedback (tenant_id);

alter table feedback enable row level security;

-- Auto-assigns tenant_id the same way companies/contacts/prospects/etc.
-- already do (set_tenant_id(), from sprint9) -- the app never passes it.
create trigger feedback_set_tenant before insert on feedback
  for each row execute function set_tenant_id();

-- Written with (select ...) from the start, matching the sprint19 fix.
create policy "feedback insertable by authenticated" on feedback
  for insert to authenticated
  with check (submitted_by = (select auth.uid()));
create policy "feedback readable by admins" on feedback
  for select to authenticated
  using ((select current_user_role()) = 'admin' and tenant_id = (select current_tenant_id()));
