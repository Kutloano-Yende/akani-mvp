-- Roles and status enums
create type user_role as enum ('admin', 'manager', 'sales');
create type prospect_status as enum ('identified', 'qualified', 'contacted', 'interested', 'application', 'won', 'lost');
create type opportunity_level as enum ('low', 'medium', 'high');

-- Profiles: extends auth.users with app-level role
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role user_role not null default 'sales',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Companies sourced from the data provider (or manually added)
create table companies (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  source text,
  name text not null,
  registration_number text,
  industry text,
  province text,
  city text,
  employee_count int,
  revenue_range text,
  website text,
  phone text,
  email text,
  address text,
  opportunity_score int,
  opportunity_level opportunity_level,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_id, source)
);

create index companies_industry_idx on companies (industry);
create index companies_province_idx on companies (province);

-- Contacts at a company
create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  external_id text,
  first_name text,
  last_name text,
  job_title text,
  email text,
  phone text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_company_id_idx on contacts (company_id);

-- Prospects: the sales record tracking a company through the funnel
create table prospects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  status prospect_status not null default 'identified',
  qualification_status text,
  opportunity_score int,
  assigned_to uuid references profiles(id),
  first_contacted_at timestamptz,
  last_contacted_at timestamptz,
  qualified_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

create index prospects_status_idx on prospects (status);
create index prospects_assigned_to_idx on prospects (assigned_to);

-- Opportunity signals: explain why a company was surfaced
create table opportunity_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  signal_type text not null,
  description text not null,
  weight int not null default 1,
  source text,
  created_at timestamptz not null default now()
);

create index opportunity_signals_company_id_idx on opportunity_signals (company_id);

-- Activities: audit trail of what happened on a prospect
create table activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  user_id uuid references profiles(id),
  type text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index activities_prospect_id_idx on activities (prospect_id);

-- Keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger companies_set_updated_at before update on companies
  for each row execute function set_updated_at();
create trigger contacts_set_updated_at before update on contacts
  for each row execute function set_updated_at();
create trigger prospects_set_updated_at before update on prospects
  for each row execute function set_updated_at();

-- New auth user -> profile row
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'sales');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS: this is an internal staff tool. Any authenticated (staff) user
-- can read/write working records; profiles are self-managed except role
-- changes, which go through the service role from an admin-only API route.
alter table profiles enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table prospects enable row level security;
alter table opportunity_signals enable row level security;
alter table activities enable row level security;

create policy "profiles readable by authenticated" on profiles
  for select to authenticated using (true);
create policy "profiles updatable by self" on profiles
  for update to authenticated using (id = auth.uid());

create policy "companies readable by authenticated" on companies
  for select to authenticated using (true);
create policy "companies writable by authenticated" on companies
  for insert to authenticated with check (true);
create policy "companies updatable by authenticated" on companies
  for update to authenticated using (true);

create policy "contacts readable by authenticated" on contacts
  for select to authenticated using (true);
create policy "contacts writable by authenticated" on contacts
  for insert to authenticated with check (true);
create policy "contacts updatable by authenticated" on contacts
  for update to authenticated using (true);

create policy "prospects readable by authenticated" on prospects
  for select to authenticated using (true);
create policy "prospects writable by authenticated" on prospects
  for insert to authenticated with check (true);
create policy "prospects updatable by authenticated" on prospects
  for update to authenticated using (true);

create policy "signals readable by authenticated" on opportunity_signals
  for select to authenticated using (true);
create policy "signals writable by authenticated" on opportunity_signals
  for insert to authenticated with check (true);

create policy "activities readable by authenticated" on activities
  for select to authenticated using (true);
create policy "activities writable by authenticated" on activities
  for insert to authenticated with check (true);
