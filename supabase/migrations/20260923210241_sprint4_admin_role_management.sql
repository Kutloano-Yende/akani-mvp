-- Lets an admin change another user's role without the service-role key —
-- the function checks the CALLER is admin internally (via auth.uid()),
-- so it's safe to grant EXECUTE broadly; a non-admin calling it just gets
-- an exception, same effect as not having the RPC at all.
create or replace function admin_update_user_role(target_user_id uuid, new_role user_role)
returns void as $$
declare
  caller_role user_role;
begin
  select role into caller_role from profiles where id = auth.uid();

  if caller_role is distinct from 'admin' then
    raise exception 'Only admins can change user roles';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Ask another admin to change your own role';
  end if;

  update profiles set role = new_role where id = target_user_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.admin_update_user_role(uuid, user_role) from public, anon;
grant execute on function public.admin_update_user_role(uuid, user_role) to authenticated;
