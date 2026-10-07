-- Suspend/reactivate individual users (including platform admins), and a
-- safe pre-check for deleting one. Mirrors the tenants status/suspended_at
-- pattern (see 20260927100000_sprint9_tenancy_foundation.sql) but per-user.
alter table profiles add column status text not null default 'active' check (status in ('active', 'suspended'));
alter table profiles add column suspended_at timestamptz;

-- Mirrors admin_update_user_role (20260923210241_sprint4_admin_role_management.sql):
-- the route does a cheap first-pass check, this function is the real
-- enforcement, re-checking the caller from auth.uid() itself so it's safe
-- to grant EXECUTE broadly. Unlike the role RPC, this one also has to
-- decide whether the TARGET is a platform admin, since that changes who's
-- allowed to act and adds the last-remaining-platform-admin guard.
create or replace function admin_set_user_status(target_user_id uuid, new_status text)
returns void as $$
declare
  caller_role user_role;
  caller_tenant uuid;
  caller_is_platform_admin boolean;
  target_tenant uuid;
  target_is_platform_admin boolean;
begin
  if new_status not in ('active', 'suspended') then
    raise exception 'new_status must be active or suspended';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Ask another admin to change your own status';
  end if;

  select role, tenant_id into caller_role, caller_tenant from profiles where id = auth.uid();
  caller_is_platform_admin := is_platform_admin();

  select tenant_id into target_tenant from profiles where id = target_user_id;
  if not found then
    raise exception 'User not found';
  end if;
  target_is_platform_admin := exists(select 1 from platform_admins where user_id = target_user_id);

  if target_is_platform_admin then
    if not caller_is_platform_admin then
      raise exception 'Only a platform admin can change another platform admin''s status';
    end if;
    if new_status = 'suspended' and (select count(*) from platform_admins) <= 1 then
      raise exception 'Can''t suspend the last remaining platform admin';
    end if;
  else
    if not (caller_is_platform_admin or (caller_role = 'admin' and caller_tenant = target_tenant)) then
      raise exception 'Only an admin for this user''s tenant (or a platform admin) can change their status';
    end if;
  end if;

  update profiles
    set status = new_status, suspended_at = case when new_status = 'suspended' then now() else null end
    where id = target_user_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.admin_set_user_status(uuid, text) from public, anon;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

-- Real deletion (admin.auth.admin.deleteUser) cascades profiles but every
-- OTHER table that references a user -- audit_logs, prospects, feedback,
-- impersonation_sessions, etc. -- uses a plain FK with no `on delete`
-- clause, i.e. Postgres's default restrict. So deleting anyone who's ever
-- signed in (which already writes an audit_logs row) throws a foreign-key
-- violation. This checks first, so the caller gets a clear "suspend them
-- instead" rather than a raw DB error.
--
-- Walks pg_constraint/pg_attribute directly (not information_schema) and
-- matches conkey/confkey by POSITION, because several of these FKs are
-- composite (e.g. prospects' (tenant_id, assigned_to) referencing
-- profiles(tenant_id, id) from sprint9) -- a plain information_schema join
-- on constraint_name alone would cross-join composite columns and check
-- the wrong pairs. This way it stays correct as new tables get added later
-- without needing to be hand-maintained.
create or replace function user_has_history(target_user_id uuid)
returns boolean as $$
declare
  fk record;
  found_row boolean;
begin
  for fk in
    select
      con.conrelid::regclass::text as local_table,
      att_local.attname as local_column
    from pg_constraint con
    join pg_attribute att_conf
      on att_conf.attrelid = con.confrelid
     and att_conf.attnum = any(con.confkey)
    join pg_attribute att_local
      on att_local.attrelid = con.conrelid
     and att_local.attnum = con.conkey[array_position(con.confkey, att_conf.attnum)]
    where con.contype = 'f'
      and con.confrelid = 'public.profiles'::regclass
      and att_conf.attname = 'id'
  loop
    execute format('select exists(select 1 from %s where %I = $1)', fk.local_table, fk.local_column)
      into found_row using target_user_id;
    if found_row then
      return true;
    end if;
  end loop;
  return false;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.user_has_history(uuid) from public, anon;
grant execute on function public.user_has_history(uuid) to authenticated;

-- Mirrors current_tenant_id()'s existing "t.status = 'active'" guard
-- (20260927100000_sprint9_tenancy_foundation.sql), which is the REAL
-- enforcement for a suspended tenant -- /account-suspended is just a
-- clearer redirect than letting every page look silently empty. Without
-- this, a suspended user's RLS access wouldn't actually be revoked at the
-- DB layer, only blocked by middleware -- this closes that gap the same
-- way tenant suspension already does.
create or replace function current_tenant_id()
returns uuid as $$
  select p.tenant_id from profiles p
    join tenants t on t.id = p.tenant_id
    where p.id = auth.uid() and t.status = 'active' and p.status = 'active'
$$ language sql stable security definer set search_path = public;

create or replace function is_platform_admin()
returns boolean as $$
  select exists (
    select 1 from platform_admins pa
    join profiles p on p.id = pa.user_id
    where pa.user_id = auth.uid() and p.status = 'active'
  )
$$ language sql stable security definer set search_path = public;
