create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on audit_logs (created_at desc);
create index audit_logs_user_id_idx on audit_logs (user_id);

-- The client can never be trusted to say who performed an action — force
-- user_id to the session's own auth.uid() server-side, regardless of what
-- the insert payload claims.
create or replace function set_audit_user_id()
returns trigger as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger audit_logs_set_user_id before insert on audit_logs
  for each row execute function set_audit_user_id();

revoke execute on function public.set_audit_user_id() from public;

alter table audit_logs enable row level security;

-- Append-only and admin-readable: no update/delete policy exists for
-- anyone, and only admins can select, so the trail can't be edited, hidden,
-- or read by the person it might be about.
create policy "audit logs readable by admins" on audit_logs
  for select to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');

create policy "audit logs insertable by authenticated" on audit_logs
  for insert to authenticated with check (true);

create table suppression_list (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  reason text,
  source text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint suppression_list_has_contact check (email is not null or phone is not null)
);

create unique index suppression_list_email_idx on suppression_list (lower(email)) where email is not null;
create unique index suppression_list_phone_idx on suppression_list (phone) where phone is not null;

alter table suppression_list enable row level security;

create policy "suppression list readable by admins" on suppression_list
  for select to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');

create policy "suppression list writable by admins" on suppression_list
  for insert to authenticated
  with check ((select role from profiles where id = auth.uid()) = 'admin');

create policy "suppression list deletable by admins" on suppression_list
  for delete to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');
