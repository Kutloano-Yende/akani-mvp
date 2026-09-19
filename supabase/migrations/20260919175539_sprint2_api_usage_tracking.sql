create table api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  provider text not null,
  endpoint text not null,
  results_returned int not null default 0,
  credits_used int not null default 1,
  created_at timestamptz not null default now()
);

create index api_usage_created_at_idx on api_usage (created_at desc);
create index api_usage_provider_idx on api_usage (provider);

alter table api_usage enable row level security;

create policy "api usage readable by authenticated" on api_usage
  for select to authenticated using (true);
create policy "api usage writable by authenticated" on api_usage
  for insert to authenticated with check (true);
