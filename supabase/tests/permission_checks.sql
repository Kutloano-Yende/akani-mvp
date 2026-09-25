-- Checks for the "may we keep in touch?" flow (answer_permission). Creates
-- throwaway records, exercises the function as a signed-out visitor, and rolls
-- back. Run in the Supabase SQL editor after changing anything it touches.
begin;

insert into companies (id, name) values ('cccccccc-1111-4000-8000-000000000001', 'Permission Test Co');
insert into prospects (id, company_id) values ('dddddddd-1111-4000-8000-000000000001', 'cccccccc-1111-4000-8000-000000000001');
insert into contacts (company_id, first_name, email) values ('cccccccc-1111-4000-8000-000000000001', 'Perm', 'perm.test@example.com');
insert into campaigns (id, name) values ('eeeeeeee-1111-4000-8000-000000000001', 'Permission test campaign');
insert into campaign_prospects (id, campaign_id, prospect_id, recipient_email, unsubscribe_token)
  values ('ffffffff-1111-4000-8000-000000000001', 'eeeeeeee-1111-4000-8000-000000000001',
          'dddddddd-1111-4000-8000-000000000001', 'Perm.Test@Example.com',
          '99999999-1111-4000-8000-000000000001');

do $$
declare r jsonb; n int;
begin
  set local role anon;

  -- Unknown token, or a nonsense answer, does nothing.
  assert answer_permission('00000000-0000-4000-8000-000000000000', 'yes') is null, 'unknown token must return null';
  assert answer_permission('99999999-1111-4000-8000-000000000001', 'maybe') is null, 'invalid answer must return null';

  -- Yes is recorded and reports who answered.
  r := answer_permission('99999999-1111-4000-8000-000000000001', 'yes');
  assert (r->>'ok')::boolean and (r->>'changed')::boolean, 'first yes must be recorded';
  assert r->>'email' = 'perm.test@example.com', 'email must be lower-cased';
  assert r->>'first_name' = 'Perm' and r->>'company' = 'Permission Test Co', 'must report the contact and company';

  -- Answering yes again is a no-op (a refresh or a link scanner).
  r := answer_permission('99999999-1111-4000-8000-000000000001', 'yes');
  assert not (r->>'changed')::boolean, 'repeat yes must not change anything';

  -- No suppresses the address.
  r := answer_permission('99999999-1111-4000-8000-000000000001', 'no');
  assert (r->>'changed')::boolean, 'yes -> no must be recorded';
  reset role;
  select count(*) into n from suppression_list where email = 'perm.test@example.com' and source = 'permission';
  assert n = 1, 'a no must add the address to the suppression list';

  -- Repeating no adds nothing more.
  set local role anon;
  perform answer_permission('99999999-1111-4000-8000-000000000001', 'no');
  reset role;
  select count(*) into n from suppression_list where email = 'perm.test@example.com';
  assert n = 1, 'a repeated no must not duplicate the suppression entry';

  -- Changing their mind lifts the suppression this flow created.
  set local role anon;
  perform answer_permission('99999999-1111-4000-8000-000000000001', 'yes');
  reset role;
  select count(*) into n from suppression_list where email = 'perm.test@example.com';
  assert n = 0, 'a later yes must lift the permission suppression';

  -- ...but never an unsubscribe or an admin's entry.
  insert into suppression_list (email, reason, source) values ('perm.test@example.com', 'Unsubscribed via email link', 'unsubscribe');
  set local role anon;
  perform answer_permission('99999999-1111-4000-8000-000000000001', 'no');
  perform answer_permission('99999999-1111-4000-8000-000000000001', 'yes');
  reset role;
  select count(*) into n from suppression_list where email = 'perm.test@example.com' and source = 'unsubscribe';
  assert n = 1, 'a yes must never lift an unsubscribe';

  -- History is recorded.
  select count(*) into n from activities where prospect_id = 'dddddddd-1111-4000-8000-000000000001' and type like 'PERMISSION_%';
  assert n >= 3, 'answers must be logged as activities';
  select count(*) into n from audit_logs where action like 'PERMISSION_%';
  assert n >= 3, 'answers must be written to the audit log';

  -- The function is callable by anonymous visitors, but only with a real token.
  assert has_function_privilege('anon', 'public.answer_permission(uuid,text)', 'execute'), 'anon must be able to call it';
  assert not has_function_privilege('public', 'public.answer_permission(uuid,text)', 'execute'), 'public must not';
end $$;

rollback;
select 'Permission checks passed' as result;
