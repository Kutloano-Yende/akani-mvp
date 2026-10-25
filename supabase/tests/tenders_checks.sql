-- Row-level-security regression checks for Tender Intelligence (tenders +
-- saved_tenders). Self-contained: creates a throwaway second tenant and
-- throwaway users, exercises the rules as each role, and ROLLS BACK, so it
-- leaves nothing behind. Any failed assertion aborts with a message.
--
-- Run it in the Supabase SQL editor, or:  psql "$DATABASE_URL" -f supabase/tests/tenders_checks.sql
-- Re-run after any migration that touches tenders/saved_tenders policies,
-- grants or auth functions.

begin;

-- Fixtures (as the table owner) ----------------------------------------------

-- A second tenant, so saved_tenders' cross-tenant isolation can actually be
-- exercised (the default/only tenant most other test fixtures use is
-- Akani's own constant, '11111111-1111-4111-8111-111111111111').
insert into tenants (id, name, slug) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'RLS Test Tenant 2', 'rls-test-tenant-2');

-- tenant-1 users default to Akani's own tenant via handle_new_user()'s
-- fallback; tenant-2's user gets an explicit tenant_id via raw_user_meta_data,
-- the same mechanism handle_new_user() reads (see
-- supabase/migrations/20260929135102_sprint12_tenant_isolation.sql).
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'tenders-t1-sales@test.local', 'authenticated', 'authenticated', '{}'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'tenders-t1-manager@test.local', 'authenticated', 'authenticated', '{}'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'tenders-t2-sales@test.local', 'authenticated', 'authenticated',
    '{"tenant_id":"bbbbbbbb-0000-4000-8000-000000000002"}'),
  ('eeeeeeee-0000-4000-8000-000000000004', 'tenders-platform-admin@test.local', 'authenticated', 'authenticated', '{}');

update profiles set role = 'manager' where id = 'eeeeeeee-0000-4000-8000-000000000002';
insert into platform_admins (user_id) values ('eeeeeeee-0000-4000-8000-000000000004');

-- Three tenders, inserted directly as the table owner -- in production this
-- only ever happens via the service-role sync client (see
-- src/lib/tenders/sync.ts), never through an authenticated session.
-- Multiple tenders exist purely so later scenarios each have a (tenant,
-- tender) pair that isn't already occupied by an earlier scenario's fixture
-- row (saved_tenders_tenant_tender_key correctly rejects a second save of
-- the same tender by the same tenant, which earlier draft of this script
-- ran into).
insert into tenders (id, ocid, release_id, title, status, published_date, raw) values
  ('cccccccc-0000-4000-8000-000000000001', 'ocds-9t57fa-rls-test-1', 'ocds-9t57fa-rls-test-1-2026-01-01',
   'RLS Test Tender', 'active', now(), '{}'::jsonb),
  ('cccccccc-0000-4000-8000-000000000002', 'ocds-9t57fa-rls-test-2', 'ocds-9t57fa-rls-test-2-2026-01-01',
   'RLS Test Tender 2', 'active', now(), '{}'::jsonb),
  ('cccccccc-0000-4000-8000-000000000003', 'ocds-9t57fa-rls-test-3', 'ocds-9t57fa-rls-test-3-2026-01-01',
   'RLS Test Tender 3', 'active', now(), '{}'::jsonb);

-- One award signal, same deliberate "insert as table owner" shape as
-- tenders above -- in production only syncTenders() writes this, via the
-- service-role client (see supabase/migrations/20261025090000_sprint29_tender_award_signals.sql).
insert into tender_awards (id, tender_id, award_id, supplier_name, value_amount, value_currency) values
  ('ffffffff-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'award-rls-test-1',
   'RLS Test Supplier', 50871120, 'ZAR');

-- Global read, any tenant -----------------------------------------------------
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
  select count(*) into n from tenders where id = 'cccccccc-0000-4000-8000-000000000001';
  assert n = 1, 'tenant 1 must read the global tenders table';
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000003","role":"authenticated"}', true);
  select count(*) into n from tenders where id = 'cccccccc-0000-4000-8000-000000000001';
  assert n = 1, 'tenant 2 must read the SAME global tenders row -- it is not tenant-owned';
  reset role;
end $$;

-- tender_awards: global read, any tenant, same shape as tenders above --------
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
  select count(*) into n from tender_awards where id = 'ffffffff-0000-4000-8000-000000000001';
  assert n = 1, 'tenant 1 must read the global tender_awards table';
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000003","role":"authenticated"}', true);
  select count(*) into n from tender_awards where id = 'ffffffff-0000-4000-8000-000000000001';
  assert n = 1, 'tenant 2 must read the SAME global tender_awards row -- it is not tenant-owned';
  reset role;
end $$;

-- Authenticated users cannot write tender_awards directly ---------------------
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);

  begin
    insert into tender_awards (tender_id, award_id, supplier_name)
      values ('cccccccc-0000-4000-8000-000000000001', 'award-fake', 'Fake Supplier');
    raise exception 'an authenticated user inserted into tender_awards directly';
  exception when insufficient_privilege then null;
  end;

  begin
    update tender_awards set supplier_name = 'Tampered' where id = 'ffffffff-0000-4000-8000-000000000001';
    raise exception 'an authenticated user updated tender_awards directly';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from tender_awards where id = 'ffffffff-0000-4000-8000-000000000001';
    raise exception 'an authenticated user deleted from tender_awards directly';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- GRANT-level protection holds for tender_awards even if RLS were disabled ----
do $$
begin
  alter table tender_awards disable row level security;

  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
  begin
    insert into tender_awards (tender_id, award_id, supplier_name)
      values ('cccccccc-0000-4000-8000-000000000001', 'award-fake-2', 'Fake Supplier 2');
    raise exception 'an authenticated user inserted into tender_awards with RLS disabled -- the GRANT revoke alone must still block this';
  exception when insufficient_privilege then null;
  end;
  reset role;

  alter table tender_awards enable row level security;
end $$;

-- Authenticated users cannot write tenders directly ---------------------------
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);

  begin
    insert into tenders (ocid, release_id, title, status, published_date, raw)
      values ('ocds-fake', 'ocds-fake-1', 'Fake', 'active', now(), '{}'::jsonb);
    raise exception 'an authenticated user inserted into tenders directly';
  exception when insufficient_privilege then null;
  end;

  begin
    update tenders set title = 'Tampered' where id = 'cccccccc-0000-4000-8000-000000000001';
    raise exception 'an authenticated user updated tenders directly';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from tenders where id = 'cccccccc-0000-4000-8000-000000000001';
    raise exception 'an authenticated user deleted from tenders directly';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- GRANT-level protection holds even if RLS were disabled ----------------------
-- Defense in depth: the migration both REVOKEs insert/update/delete from
-- anon/authenticated AND relies on RLS default-deny. This proves the REVOKE
-- alone -- not just RLS -- blocks a write, by disabling RLS on tenders
-- (as the table owner, inside this same rolled-back transaction) and
-- confirming an authenticated insert still fails on privilege alone.
do $$
begin
  alter table tenders disable row level security;

  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
  begin
    insert into tenders (ocid, release_id, title, status, published_date, raw)
      values ('ocds-fake-2', 'ocds-fake-2-1', 'Fake', 'active', now(), '{}'::jsonb);
    raise exception 'an authenticated user inserted into tenders with RLS disabled -- the GRANT revoke alone must still block this';
  exception when insufficient_privilege then null;
  end;
  reset role;

  alter table tenders enable row level security;
end $$;

-- Client-supplied tenant_id is ignored on insert -------------------------------
do $$
declare actual_tenant uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);

  -- Tenant 1's user explicitly claims tenant 2's id; the trigger must
  -- override it to the session's real tenant regardless of the payload.
  insert into saved_tenders (id, tenant_id, tender_id, saved_by)
    values ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
            'cccccccc-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000001');
  reset role;

  select tenant_id into actual_tenant from saved_tenders where id = 'dddddddd-0000-4000-8000-000000000001';
  assert actual_tenant = '11111111-1111-4111-8111-111111111111',
    'set_tenant_id() must override a client-supplied tenant_id, not trust it';
end $$;

-- No cross-tenant leak on the SAME tender ---------------------------------------
do $$
declare n int;
begin
  -- Tenant 2 saves the same tender tenant 1 already saved above.
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000003","role":"authenticated"}', true);
  insert into saved_tenders (id, tenant_id, tender_id, saved_by)
    values ('dddddddd-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
            'cccccccc-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000003');
  -- (tenant_id above is deliberately wrong too, to double-check the trigger again under a different user)

  select count(*) into n from saved_tenders where tender_id = 'cccccccc-0000-4000-8000-000000000001';
  assert n = 1, 'tenant 2 must see only its OWN save of this tender, never tenant 1''s';
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
  select count(*) into n from saved_tenders where tender_id = 'cccccccc-0000-4000-8000-000000000001';
  assert n = 1, 'tenant 1 must see only its OWN save of this tender, never tenant 2''s';
  reset role;
end $$;

-- Ownership-aware update: unassigned sales denied, manager allowed -------------
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);

  -- The save is unassigned, so its own saver CAN still update it (assigned_to is null).
  update saved_tenders set notes = 'sales note' where id = 'dddddddd-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'sales must update an unassigned saved tender';

  update saved_tenders set assigned_to = 'eeeeeeee-0000-4000-8000-000000000001'
    where id = 'dddddddd-0000-4000-8000-000000000001';
  reset role;

  -- Now assigned to a DIFFERENT user than the one about to try.
  update saved_tenders set assigned_to = 'eeeeeeee-0000-4000-8000-000000000002'
    where id = 'dddddddd-0000-4000-8000-000000000001';

  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
  update saved_tenders set notes = 'should not land' where id = 'dddddddd-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'sales must NOT update a saved tender assigned to someone else';
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
  update saved_tenders set notes = 'manager note' where id = 'dddddddd-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'manager must update any saved tender within the tenant';
  reset role;
end $$;

-- Sales can self-claim an unassigned save, but cannot hand it to a colleague ---
-- This is the specific thing to watch for a "direct Supabase access" bypass:
-- RLS's update policy reuses its USING clause as the WITH CHECK (no separate
-- WITH CHECK is declared), so the policy is evaluated against the NEW row
-- too. A sales user may only ever land on assigned_to = null, their own
-- auth.uid(), or be admin/manager -- never a third party's id.
--
-- Note the failure mode here is a hard RLS error (SQLSTATE 42501 /
-- insufficient_privilege), not a silent 0-row update: the OLD row DOES pass
-- USING (it's unassigned), so Postgres proceeds to the update and only then
-- finds the NEW row fails the check -- same error class
-- supabase/tests/rls_checks.sql already expects for the equivalent prospects
-- scenario ("sales handed their prospect to someone else").
do $$
declare n int;
begin
  reset role;
  insert into saved_tenders (id, tenant_id, tender_id, saved_by)
    values ('dddddddd-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
            'cccccccc-0000-4000-8000-000000000002', 'eeeeeeee-0000-4000-8000-000000000001');

  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);

  begin
    update saved_tenders set assigned_to = 'eeeeeeee-0000-4000-8000-000000000002'
      where id = 'dddddddd-0000-4000-8000-000000000003';
    raise exception 'a sales user handed an unassigned save to a colleague directly';
  exception when insufficient_privilege then null;
  end;

  update saved_tenders set assigned_to = 'eeeeeeee-0000-4000-8000-000000000001'
    where id = 'dddddddd-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  assert n = 1, 'a sales user must still be able to self-claim an unassigned save';
  reset role;
end $$;

-- Cross-tenant update/delete by a correct UUID is still denied -----------------
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000003","role":"authenticated"}', true);

  update saved_tenders set notes = 'cross-tenant write' where id = 'dddddddd-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'tenant 2 must NOT update tenant 1''s saved_tenders row, even by a correct id';

  -- Explicitly the assigned_to column, not just notes -- "assign a saved
  -- tender belonging to another tenant" is its own named requirement.
  update saved_tenders set assigned_to = 'eeeeeeee-0000-4000-8000-000000000003'
    where id = 'dddddddd-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'tenant 2 must NOT assign tenant 1''s saved_tenders row, even by a correct id';

  delete from saved_tenders where id = 'dddddddd-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'tenant 2 must NOT delete tenant 1''s saved_tenders row, even by a correct id';
  reset role;
end $$;

-- Platform admin reads across tenants -------------------------------------------
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000004","role":"authenticated"}', true);
  select count(*) into n from saved_tenders where tender_id = 'cccccccc-0000-4000-8000-000000000001';
  assert n = 2, 'a platform admin must see both tenants'' saves of this tender';
  reset role;
end $$;

-- Cross-tenant assigned_to is rejected at the database level --------------------
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);

  begin
    insert into saved_tenders (tenant_id, tender_id, saved_by, assigned_to)
      values ('11111111-1111-4111-8111-111111111111', 'cccccccc-0000-4000-8000-000000000003',
              'eeeeeeee-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000003');
    raise exception 'assigned_to pointing at a different tenant''s profile was accepted';
  exception when foreign_key_violation then null;
  end;
  reset role;
end $$;

-- Anonymous (signed-out) ----------------------------------------------------------
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from tenders;
  assert n = 0, 'anon must see no tenders';
  select count(*) into n from saved_tenders;
  assert n = 0, 'anon must see no saved_tenders';
  select count(*) into n from tender_awards;
  assert n = 0, 'anon must see no tender_awards';
  reset role;
end $$;

rollback;
select 'Tender Intelligence RLS checks passed' as result;
