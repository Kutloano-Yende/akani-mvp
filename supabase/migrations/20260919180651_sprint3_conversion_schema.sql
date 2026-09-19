create type campaign_status as enum ('draft', 'active', 'completed');
create type campaign_prospect_status as enum ('pending', 'sent', 'opened', 'replied');
create type application_status as enum ('submitted', 'approved', 'rejected');
create type conversion_status as enum ('pending', 'confirmed', 'rejected');

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status campaign_status not null default 'draft',
  template_id uuid references email_templates(id),
  created_by uuid references profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaign_prospects (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  prospect_id uuid not null references prospects(id) on delete cascade,
  status campaign_prospect_status not null default 'pending',
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, prospect_id)
);

create index campaign_prospects_campaign_id_idx on campaign_prospects (campaign_id);
create index campaign_prospects_prospect_id_idx on campaign_prospects (prospect_id);

create table applications (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  status application_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_prospect_id_idx on applications (prospect_id);

create table conversions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  status conversion_status not null default 'confirmed',
  converted_at timestamptz,
  reported_by uuid references profiles(id),
  reported_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversions_prospect_id_idx on conversions (prospect_id);

create trigger email_templates_set_updated_at before update on email_templates
  for each row execute function set_updated_at();
create trigger campaigns_set_updated_at before update on campaigns
  for each row execute function set_updated_at();
create trigger applications_set_updated_at before update on applications
  for each row execute function set_updated_at();
create trigger conversions_set_updated_at before update on conversions
  for each row execute function set_updated_at();

alter table email_templates enable row level security;
alter table campaigns enable row level security;
alter table campaign_prospects enable row level security;
alter table applications enable row level security;
alter table conversions enable row level security;

create policy "templates readable by authenticated" on email_templates
  for select to authenticated using (true);
create policy "templates writable by authenticated" on email_templates
  for insert to authenticated with check (true);
create policy "templates updatable by authenticated" on email_templates
  for update to authenticated using (true);
create policy "templates deletable by authenticated" on email_templates
  for delete to authenticated using (true);

create policy "campaigns readable by authenticated" on campaigns
  for select to authenticated using (true);
create policy "campaigns writable by authenticated" on campaigns
  for insert to authenticated with check (true);
create policy "campaigns updatable by authenticated" on campaigns
  for update to authenticated using (true);

create policy "campaign_prospects readable by authenticated" on campaign_prospects
  for select to authenticated using (true);
create policy "campaign_prospects writable by authenticated" on campaign_prospects
  for insert to authenticated with check (true);
create policy "campaign_prospects updatable by authenticated" on campaign_prospects
  for update to authenticated using (true);

create policy "applications readable by authenticated" on applications
  for select to authenticated using (true);
create policy "applications writable by authenticated" on applications
  for insert to authenticated with check (true);
create policy "applications updatable by authenticated" on applications
  for update to authenticated using (true);

create policy "conversions readable by authenticated" on conversions
  for select to authenticated using (true);
create policy "conversions writable by authenticated" on conversions
  for insert to authenticated with check (true);
create policy "conversions updatable by authenticated" on conversions
  for update to authenticated using (true);
