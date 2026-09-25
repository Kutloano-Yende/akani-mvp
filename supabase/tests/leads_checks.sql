-- Checks for lead follow-up and call booking. Self-contained: swaps in a
-- throwaway secret inside the transaction (never touching the real one),
-- creates test data, and rolls back.
begin;

update private.app_secrets set hash = encode(sha256(convert_to('test-secret', 'UTF8')), 'hex') where name = 'leads';

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'leads-manager@test.local', 'authenticated', 'authenticated'),
  ('aaaaaaaa-3333-4000-8000-000000000002', 'leads-sales@test.local', 'authenticated', 'authenticated');
update profiles set role = 'manager' where id = 'aaaaaaaa-3333-4000-8000-000000000001';

do $$
declare
  r jsonb; n int; t1 uuid; t2 uuid; l1 uuid; l2 uuid;
  tz text; day_offset int; sat_offset int; good timestamptz; d date;
begin
  select timezone into tz from booking_settings;
  set local role anon;

  -- The secret gate ----------------------------------------------------------
  begin perform lead_intake('wrong', 'website', 'X', 'x@t.local', null, null, null);
    raise exception 'intake ran without the secret';
  exception when insufficient_privilege then null; end;
  begin perform lead_claim_due('wrong', 5);
    raise exception 'claim ran without the secret';
  exception when insufficient_privilege then null; end;
  begin perform lead_record_send('wrong', gen_random_uuid(), 1, true, null, 's', now());
    raise exception 'record ran without the secret';
  exception when insufficient_privilege then null; end;
  begin perform lead_intake(null, 'website', 'X', 'x@t.local', null, null, null);
    raise exception 'intake ran with a null secret';
  exception when insufficient_privilege then null; end;

  -- Intake ---------------------------------------------------------------------
  begin perform lead_intake('test-secret', 'website', 'X', 'not-an-email', null, null, null);
    raise exception 'intake accepted a bad email';
  exception when invalid_parameter_value then null; end;

  r := lead_intake('test-secret', 'website', 'Thandi Nkosi', 'Thandi@Test.Local', '0110000000', 'Nkosi Co', 'Hello', null);
  assert not (r->>'duplicate')::boolean, 'first intake is not a duplicate';
  assert r->>'first_name' = 'Thandi', 'first name is taken from the name';
  l1 := (r->>'lead_id')::uuid; t1 := (r->>'token')::uuid;

  r := lead_intake('test-secret', 'website', 'Thandi Again', 'thandi@test.local', null, null, null);
  assert (r->>'duplicate')::boolean and (r->>'lead_id')::uuid = l1, 'same email within 30 days returns the same lead';

  -- A suppressed address is recorded but never scheduled.
  reset role;
  insert into suppression_list (email, reason, source) values ('blocked@test.local', 'x', 'unsubscribe');
  set local role anon;
  r := lead_intake('test-secret', 'website', 'Blocked Person', 'blocked@test.local', null, null, null);
  assert (r->>'suppressed')::boolean, 'a suppressed address is flagged';
  reset role;
  select count(*) into n from leads where email = 'blocked@test.local' and status = 'unsubscribed' and next_action_at is null;
  assert n = 1, 'a suppressed lead must not be scheduled';
  set local role anon;

  -- The sequence ---------------------------------------------------------------
  r := lead_claim_due('test-secret', 10);
  assert jsonb_array_length(r) = 1 and (r->0->>'step')::int = 1, 'the new lead is claimed for step 1';
  assert (r->0->>'lead_id')::uuid = l1, 'and it is the right lead';
  r := lead_claim_due('test-secret', 10);
  assert jsonb_array_length(r) = 0, 'a leased lead is not claimed twice';

  perform lead_record_send('test-secret', l1, 1, true, null, 'Thanks', now() + interval '1 day');
  reset role;
  select count(*) into n from leads where id = l1 and status = 'contacted' and sequence_step = 1 and next_action_at > now();
  assert n = 1, 'a sent email advances the step and schedules the next';
  update leads set next_action_at = now() - interval '1 minute' where id = l1;
  set local role anon;
  r := lead_claim_due('test-secret', 10);
  assert (r->0->>'step')::int = 2, 'the next claim is step 2';

  -- Failures retry later and eventually stop.
  for i in 1..5 loop
    perform lead_record_send('test-secret', l1, 2, false, 'provider down', 'Follow up', null);
  end loop;
  reset role;
  select count(*) into n from leads where id = l1 and send_failures = 5 and next_action_at is null;
  assert n = 1, 'five failures stop the retries';
  update leads set next_action_at = now() - interval '1 minute' where id = l1;
  set local role anon;
  r := lead_claim_due('test-secret', 10);
  assert jsonb_array_length(r) = 0, 'a lead with five failures is not claimed again';

  -- Booking ----------------------------------------------------------------------
  reset role;
  update leads set send_failures = 0, next_action_at = now() + interval '1 day' where id = l1;
  set local role anon;
  r := lead_intake('test-secret', 'website', 'Second Lead', 'second@test.local', null, null, null);
  l2 := (r->>'lead_id')::uuid; t2 := (r->>'token')::uuid;

  -- first working day at least two days out, at 10:00 local time
  select g into day_offset from generate_series(2, 9) g
    where extract(isodow from ((now() at time zone tz)::date + g)) between 1 and 5 order by g limit 1;
  d := (now() at time zone tz)::date + day_offset;
  good := (d + time '10:00') at time zone tz;

  assert booking_page_data('00000000-0000-4000-8000-000000000000') is null, 'unknown token has no booking page';
  r := booking_page_data(t1);
  assert r->'settings'->>'timezone' = tz and r->'settings' ? 'host_name', 'booking page returns the settings';
  assert not (r->'settings' ? 'host_email'), 'the host email is not exposed to leads';

  r := book_slot(t1, good);
  assert (r->>'ok')::boolean, 'a valid slot books: ' || r::text;
  r := book_slot(t2, good);
  assert r->>'reason' = 'taken', 'the same slot cannot be booked twice';
  r := book_slot(t2, (d + time '07:00') at time zone tz);
  assert r->>'reason' = 'invalid', 'before working hours is refused';
  r := book_slot(t2, (d + time '17:00') at time zone tz);
  assert r->>'reason' = 'invalid', 'a slot running past closing is refused';
  r := book_slot(t2, (d + time '10:15') at time zone tz);
  assert r->>'reason' = 'invalid', 'an unaligned time is refused';
  select g into sat_offset from generate_series(2, 9) g
    where extract(isodow from ((now() at time zone tz)::date + g)) = 6 order by g limit 1;
  r := book_slot(t2, (((now() at time zone tz)::date + sat_offset) + time '10:00') at time zone tz);
  assert r->>'reason' = 'invalid', 'a Saturday is refused';
  r := book_slot(t2, now() - interval '1 day');
  assert r->>'reason' = 'invalid', 'the past is refused';
  r := book_slot(t2, now() + interval '60 days');
  assert r->>'reason' = 'invalid', 'too far ahead is refused';
  r := book_slot('00000000-0000-4000-8000-000000000000', good);
  assert r->>'reason' = 'not_found', 'an unknown token cannot book';

  r := booking_page_data(t2);
  assert r->'taken' @> to_jsonb(good), 'the booked slot shows as taken to others';

  reset role;
  select count(*) into n from leads where id = l1 and status = 'booked' and next_action_at is null;
  assert n = 1, 'booking stops the emails';
  -- an email that was already in flight must not restart the sequence
  set local role anon;
  perform lead_record_send('test-secret', l1, 3, true, null, 'late', now() + interval '1 day');
  reset role;
  select count(*) into n from leads where id = l1 and status = 'booked' and next_action_at is null;
  assert n = 1, 'a late send record cannot reschedule a booked lead';

  -- Moving the booking frees the old slot.
  set local role anon;
  r := book_slot(t1, good + interval '30 minutes');
  assert (r->>'ok')::boolean, 'a booked lead can move their call';
  r := book_slot(t2, good);
  assert (r->>'ok')::boolean, 'the freed slot can be booked by someone else';

  -- Cancelling
  assert cancel_booking(t2) is not null, 'cancelling a booking works';
  assert cancel_booking(t2) is null, 'cancelling twice reports nothing to cancel';
  reset role;
  select count(*) into n from leads where id = l2 and status = 'contacted' and next_action_at is null;
  assert n = 1, 'cancelling does not restart the emails';

  -- Unsubscribing via the lead token ------------------------------------------------
  set local role anon;
  assert unsubscribe_by_token(t2), 'a lead token unsubscribes';
  assert booking_page_data(t2) is null, 'an unsubscribed lead has no booking page';
  reset role;
  select count(*) into n from suppression_list where email = 'second@test.local';
  assert n = 1, 'unsubscribing suppresses the address';
  select count(*) into n from leads where id = l2 and status = 'unsubscribed';
  assert n = 1, 'and stops the lead';
  set local role anon;
  assert unsubscribe_by_token(t2), 'unsubscribing again is harmless';
  reset role;
  select count(*) into n from audit_logs where action = 'UNSUBSCRIBED' and entity_id = l2::text;
  assert n = 1, 'a repeat unsubscribe writes no extra audit row';
end $$;

-- Staff permissions ------------------------------------------------------------------------
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-3333-4000-8000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from leads;
  assert n >= 1, 'staff can read leads';
  update leads set status = 'closed' where id = (select id from leads limit 1);
  get diagnostics n = row_count;
  assert n = 0, 'a sales user cannot change a lead';
  begin
    update booking_settings set slot_minutes = 15;
    get diagnostics n = row_count;
    assert n = 0, 'a sales user cannot change booking settings';
  end;
  reset role;

  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-3333-4000-8000-000000000001","role":"authenticated"}', true);
  set local role authenticated;
  update leads set status = 'replied' where id = (select id from leads where status = 'booked' limit 1);
  get diagnostics n = row_count;
  assert n = 1, 'a manager can update a lead';
  update booking_settings set slot_minutes = 45;
  get diagnostics n = row_count;
  assert n = 1, 'a manager can change booking settings';
  begin
    insert into leads (source, email) values ('manual', 'direct@test.local');
    raise exception 'staff inserted a lead directly';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;

rollback;
select 'Lead checks passed' as result;
