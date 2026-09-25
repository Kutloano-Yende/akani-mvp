-- Row-level-security regression checks. Self-contained: creates throwaway
-- users and records, exercises the rules as each role, and ROLLS BACK, so it
-- leaves nothing behind. Any failed assertion aborts with a message.
--
-- Run it in the Supabase SQL editor, or:  psql "$DATABASE_URL" -f supabase/tests/rls_checks.sql
-- Re-run after any migration that touches policies, grants or auth functions.

begin;

-- Fixtures (as the table owner) --------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'rls-admin@test.local',   'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'rls-manager@test.local', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'rls-sales1@test.local',  'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'rls-sales2@test.local',  'authenticated', 'authenticated');

update profiles set role = 'admin'   where id = 'aaaaaaaa-0000-4000-8000-000000000001';
update profiles set role = 'manager' where id = 'aaaaaaaa-0000-4000-8000-000000000002';

insert into companies (id, name) values
  ('cccccccc-0000-4000-8000-000000000001', 'RLS Test Co 1'),
  ('cccccccc-0000-4000-8000-000000000002', 'RLS Test Co 2'),
  ('cccccccc-0000-4000-8000-000000000003', 'RLS Test Co 3');

insert into prospects (id, company_id, assigned_to) values
  ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', null),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000003'),
  ('dddddddd-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000004');

-- Sales rep 1 ----------------------------------------------------------------
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}', true);
  set local role authenticated;

  update prospects set status = 'lost' where id = 'dddddddd-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  assert n = 0, 'sales must NOT update another rep''s prospect';

  update prospects set status = 'contacted' where id = 'dddddddd-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  assert n = 1, 'sales must update their own prospect';

  update prospects set status = 'contacted' where id = 'dddddddd-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'sales must update an unassigned prospect';

  begin
    update prospects set assigned_to = 'aaaaaaaa-0000-4000-8000-000000000004'
      where id = 'dddddddd-0000-4000-8000-000000000002';
    raise exception 'sales handed their prospect to someone else';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into campaigns (name) values ('sales must not create this');
    raise exception 'sales created a campaign';
  exception when insufficient_privilege then null;
  end;

  begin
    update profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000003';
    raise exception 'sales escalated their own role';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into suppression_list (email) values ('x@test.local');
    raise exception 'sales wrote to the suppression list';
  exception when insufficient_privilege then null;
  end;

  begin
    perform admin_update_user_role('aaaaaaaa-0000-4000-8000-000000000004', 'admin');
    raise exception 'sales changed another user''s role';
  exception when others then
    if sqlerrm = 'sales changed another user''s role' then raise; end if;
  end;

  select count(*) into n from audit_logs;      assert n = 0, 'sales must not read audit logs';
  select count(*) into n from suppression_list; assert n = 0, 'sales must not read the suppression list';
  select count(*) into n from popia_requests;   assert n = 0, 'sales must not read POPIA requests';

  -- A client cannot forge who performed an action.
  insert into audit_logs (action, user_id)
    values ('RLS_SPOOF_TEST', 'aaaaaaaa-0000-4000-8000-000000000001');
  reset role;
  select count(*) into n from audit_logs
    where action = 'RLS_SPOOF_TEST' and user_id = 'aaaaaaaa-0000-4000-8000-000000000003';
  assert n = 1, 'audit user_id must be forced to the caller';
end $$;

-- Manager ---------------------------------------------------------------------
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);
  set local role authenticated;

  update prospects set status = 'lost' where id = 'dddddddd-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  assert n = 1, 'manager must update any prospect';

  insert into campaigns (name) values ('manager campaign');

  select count(*) into n from audit_logs;
  assert n = 0, 'manager must not read audit logs (admin only)';
  reset role;
end $$;

-- Admin -----------------------------------------------------------------------
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
  set local role authenticated;

  select count(*) into n from audit_logs;
  assert n >= 1, 'admin must read audit logs';

  insert into suppression_list (email) values ('admin-added@test.local');
  insert into popia_requests (request_type, subject_email) values ('access', 'subject@test.local');

  perform admin_update_user_role('aaaaaaaa-0000-4000-8000-000000000004', 'manager');
  reset role;
  select count(*) into n from profiles
    where id = 'aaaaaaaa-0000-4000-8000-000000000004' and role = 'manager';
  assert n = 1, 'admin must be able to change another user''s role';

  set local role authenticated;
  begin
    perform admin_update_user_role('aaaaaaaa-0000-4000-8000-000000000001', 'sales');
    raise exception 'admin changed their own role';
  exception when others then
    if sqlerrm = 'admin changed their own role' then raise; end if;
  end;
  reset role;
end $$;

-- Anonymous (signed-out) --------------------------------------------------------
do $$
declare n int; ok boolean;
begin
  set local role anon;

  begin
    select count(*) into n from prospects;
    assert n = 0, 'anon must see no prospects';
  exception when insufficient_privilege then null;
  end;

  begin
    perform admin_update_user_role('aaaaaaaa-0000-4000-8000-000000000004', 'admin');
    raise exception 'anon called admin_update_user_role';
  exception when insufficient_privilege then null;
  end;

  begin
    perform current_user_role();
    raise exception 'anon called current_user_role';
  exception when insufficient_privilege then null;
  end;

  -- The public unsubscribe function is meant to be callable, but only a real token does anything.
  select unsubscribe_by_token('00000000-0000-4000-8000-000000000000') into ok;
  assert ok = false, 'unknown unsubscribe token must do nothing';
  reset role;
end $$;

rollback;
select 'RLS checks passed' as result;
