-- Role helper used by RLS policies. SECURITY INVOKER is enough because
-- profiles are readable by every authenticated user, and it means no
-- elevated function is exposed through the API.
create or replace function public.current_user_role()
returns user_role
language sql
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

revoke execute on function public.current_user_role() from public, anon, authenticated;
grant execute on function public.current_user_role() to authenticated;

-- Prospect ownership: sales staff can only modify prospects that are
-- unassigned or assigned to them. Managers and admins can modify any.
-- Reads stay open so pipeline and analytics remain team-wide.
drop policy "prospects writable by authenticated" on prospects;
drop policy "prospects updatable by authenticated" on prospects;

create policy "prospects insertable by owner or manager" on prospects
  for insert to authenticated
  with check (
    assigned_to is null
    or assigned_to = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  );

create policy "prospects updatable by owner or manager" on prospects
  for update to authenticated
  using (
    assigned_to is null
    or assigned_to = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  )
  with check (
    assigned_to is null
    or assigned_to = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  );

-- Campaigns are an outbound-email capability: managers and admins only.
drop policy "campaigns writable by authenticated" on campaigns;
drop policy "campaigns updatable by authenticated" on campaigns;
create policy "campaigns insertable by managers" on campaigns
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'manager'));
create policy "campaigns updatable by managers" on campaigns
  for update to authenticated
  using (public.current_user_role() in ('admin', 'manager'));

drop policy "campaign_prospects writable by authenticated" on campaign_prospects;
drop policy "campaign_prospects updatable by authenticated" on campaign_prospects;
create policy "campaign_prospects insertable by managers" on campaign_prospects
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'manager'));
create policy "campaign_prospects updatable by managers" on campaign_prospects
  for update to authenticated
  using (public.current_user_role() in ('admin', 'manager'));

-- POPIA request register: data-subject access and erasure requests.
create table popia_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('access', 'erasure')),
  subject_email text not null,
  subject_name text,
  notes text,
  status text not null default 'open' check (status in ('open', 'completed', 'rejected')),
  due_at timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz,
  handled_by uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index popia_requests_status_idx on popia_requests (status, due_at);

alter table popia_requests enable row level security;

create policy "popia requests readable by admins" on popia_requests
  for select to authenticated using (public.current_user_role() = 'admin');
create policy "popia requests insertable by admins" on popia_requests
  for insert to authenticated with check (public.current_user_role() = 'admin');
create policy "popia requests updatable by admins" on popia_requests
  for update to authenticated using (public.current_user_role() = 'admin');
