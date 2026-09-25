-- Lead follow-up and call booking.
--
-- Leads arrive from the website form and are answered by the server. Because
-- the anon key is public, anything that starts email must not be callable by
-- just anyone: the server-side functions below (lead_intake, lead_claim_due,
-- lead_record_send) only run when given a secret whose hash is stored in the
-- private schema (which the API doesn't expose). Set it with:
--   insert into private.app_secrets (name, hash)
--   values ('leads', encode(sha256(convert_to('<the secret>', 'UTF8')), 'hex'));
-- Booking functions, by contrast, are authorised by the per-lead token that
-- only the lead's own email contains, like unsubscribe links.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_secrets (
  name text primary key,
  hash text not null
);
revoke all on private.app_secrets from public, anon, authenticated;

create or replace function private.check_secret(p_name text, p_secret text)
returns boolean
language sql
stable
security definer
set search_path = private, pg_temp
as $$
  select exists (
    select 1 from private.app_secrets
    where name = p_name
      and hash = encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex')
  )
$$;
revoke all on function private.check_secret(text, text) from public, anon, authenticated;

create table booking_settings (
  id boolean primary key default true check (id),
  host_name text not null default 'Akani BEE Ratings',
  host_email text,
  timezone text not null default 'Africa/Johannesburg',
  slot_minutes int not null default 30 check (slot_minutes between 10 and 240),
  -- ISO weekdays: 1 = Monday ... 7 = Sunday
  working_days int[] not null default '{1,2,3,4,5}',
  start_hour int not null default 9 check (start_hour between 0 and 23),
  end_hour int not null default 17 check (end_hour between 1 and 24 and end_hour > start_hour),
  min_notice_hours int not null default 4 check (min_notice_hours >= 0),
  max_days_ahead int not null default 14 check (max_days_ahead between 1 and 90),
  meeting_details text not null default 'We''ll call you on the number you gave us. If you''d prefer a video call, just reply to the confirmation email.',
  updated_at timestamptz not null default now()
);
insert into booking_settings default values;

create table leads (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('website', 'permission', 'manual')),
  name text,
  first_name text,
  email text not null,
  phone text,
  company_name text,
  message text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'booked', 'replied', 'unsubscribed', 'closed')),
  -- Emails sent so far: 0 = none, 1 = the instant reply, 2-4 = the follow-ups.
  sequence_step int not null default 0 check (sequence_step between 0 and 4),
  next_action_at timestamptz,
  last_emailed_at timestamptz,
  send_failures int not null default 0,
  booked_at timestamptz,
  prospect_id uuid references prospects(id) on delete set null,
  -- Authorises this lead's booking page and unsubscribe link.
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);
create index leads_due_idx on leads (next_action_at) where next_action_at is not null;
create index leads_email_idx on leads (lower(email));

create table lead_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  step int not null,
  subject text,
  status text not null check (status in ('sent', 'failed')),
  error text,
  sent_at timestamptz not null default now(),
  unique (lead_id, step)
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
-- Two people can never hold the same slot.
create unique index bookings_confirmed_start_idx on bookings (start_at) where status = 'confirmed';
create index bookings_lead_idx on bookings (lead_id);

alter table booking_settings enable row level security;
alter table leads enable row level security;
alter table lead_emails enable row level security;
alter table bookings enable row level security;

create policy "booking settings readable by staff" on booking_settings
  for select to authenticated using (true);
create policy "booking settings updatable by managers" on booking_settings
  for update to authenticated
  using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));

create policy "leads readable by staff" on leads for select to authenticated using (true);
create policy "leads updatable by managers" on leads
  for update to authenticated
  using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));

create policy "lead emails readable by staff" on lead_emails for select to authenticated using (true);
create policy "bookings readable by staff" on bookings for select to authenticated using (true);

-- Server-side: create a lead. Duplicates within 30 days return the existing
-- lead; an address on the suppression list is recorded but never emailed.
create or replace function public.lead_intake(
  p_secret text, p_source text, p_name text, p_email text, p_phone text,
  p_company text, p_message text, p_prospect_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_existing leads%rowtype;
  v_id uuid;
  v_token uuid;
  v_first text;
  v_suppressed boolean;
begin
  if not private.check_secret('leads', p_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if p_source not in ('website', 'permission', 'manual') then
    raise exception 'invalid source' using errcode = '22023';
  end if;

  select * into v_existing from leads
    where lower(email) = v_email
      and status in ('new', 'contacted', 'booked')
      and created_at > now() - interval '30 days'
    order by created_at desc limit 1;
  if found then
    return jsonb_build_object('lead_id', v_existing.id, 'token', v_existing.token,
      'first_name', v_existing.first_name, 'company', v_existing.company_name,
      'duplicate', true, 'suppressed', false, 'step', v_existing.sequence_step);
  end if;

  v_first := nullif(split_part(trim(coalesce(p_name, '')), ' ', 1), '');
  select exists (select 1 from suppression_list where lower(email) = v_email) into v_suppressed;

  insert into leads (source, name, first_name, email, phone, company_name, message,
                     prospect_id, status, next_action_at)
    values (p_source, left(trim(p_name), 120), left(v_first, 60), v_email, left(trim(p_phone), 40),
            left(trim(p_company), 160), left(trim(p_message), 2000), p_prospect_id,
            case when v_suppressed then 'unsubscribed' else 'new' end,
            case when v_suppressed then null else now() end)
    returning id, token into v_id, v_token;

  if p_prospect_id is not null then
    insert into activities (prospect_id, type, description)
      values (p_prospect_id, 'LEAD_CREATED', 'Became a lead (' || p_source || ')');
  end if;
  insert into audit_logs (action, entity_type, entity_id, metadata)
    values ('LEAD_CREATED', 'lead', v_id::text,
            jsonb_build_object('source', p_source, 'suppressed', v_suppressed));

  return jsonb_build_object('lead_id', v_id, 'token', v_token, 'first_name', v_first,
    'company', nullif(trim(coalesce(p_company, '')), ''), 'duplicate', false,
    'suppressed', v_suppressed, 'step', 0);
end;
$$;

-- Server-side: lease the leads whose next email is due. The lease means two
-- overlapping runs never send the same email twice; a run that dies simply lets
-- the lease expire and the lead is picked up again.
create or replace function public.lead_claim_due(p_secret text, p_limit int default 25)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not private.check_secret('leads', p_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Anyone suppressed since they became a lead must stop receiving emails.
  update leads l set status = 'unsubscribed', next_action_at = null
    where l.status in ('new', 'contacted')
      and exists (select 1 from suppression_list s where lower(s.email) = lower(l.email));

  with due as (
    select l.id from leads l
      where l.status in ('new', 'contacted')
        and l.next_action_at is not null and l.next_action_at <= now()
        and l.sequence_step < 4 and l.send_failures < 5
      order by l.next_action_at
      limit greatest(1, least(coalesce(p_limit, 25), 100))
      for update skip locked
  ), claimed as (
    update leads l set next_action_at = now() + interval '30 minutes'
      from due where l.id = due.id
      returning l.id, l.email, l.first_name, l.company_name, l.token, l.sequence_step, l.source
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'lead_id', id, 'email', email, 'first_name', first_name, 'company', company_name,
      'token', token, 'step', sequence_step + 1, 'source', source)), '[]'::jsonb)
    into v_rows from claimed;

  return v_rows;
end;
$$;

-- Server-side: record the outcome of an email and schedule the next one.
create or replace function public.lead_record_send(
  p_secret text, p_lead_id uuid, p_step int, p_ok boolean, p_error text,
  p_subject text, p_next_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prospect uuid;
begin
  if not private.check_secret('leads', p_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into lead_emails (lead_id, step, subject, status, error)
    values (p_lead_id, p_step, left(p_subject, 300),
            case when p_ok then 'sent' else 'failed' end, left(p_error, 500))
    on conflict (lead_id, step) do update
      set subject = excluded.subject, status = excluded.status,
          error = excluded.error, sent_at = now();

  select prospect_id into v_prospect from leads where id = p_lead_id;

  if p_ok then
    update leads set
        sequence_step = greatest(sequence_step, p_step),
        status = case when status = 'new' then 'contacted' else status end,
        last_emailed_at = now(),
        send_failures = 0,
        -- Only keep the sequence going while the lead is still active; a lead who
        -- booked or unsubscribed mid-send must not be re-scheduled.
        next_action_at = case when status in ('new', 'contacted') then p_next_at else null end
      where id = p_lead_id;
    if v_prospect is not null then
      insert into activities (prospect_id, type, description)
        values (v_prospect, 'LEAD_EMAIL_SENT', 'Lead email ' || p_step || ' of 4 sent');
    end if;
  else
    update leads set
        send_failures = send_failures + 1,
        next_action_at = case when send_failures + 1 >= 5 then null
                              else now() + interval '6 hours' end
      where id = p_lead_id and status in ('new', 'contacted');
  end if;
end;
$$;

-- Public, token-authorised: what the booking page needs to show.
create or replace function public.booking_page_data(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead leads%rowtype;
  v_set booking_settings%rowtype;
  v_booking bookings%rowtype;
begin
  select * into v_lead from leads where token = p_token;
  if not found or v_lead.status in ('unsubscribed', 'closed') then
    return null;
  end if;
  select * into v_set from booking_settings limit 1;
  select * into v_booking from bookings
    where lead_id = v_lead.id and status = 'confirmed' order by start_at desc limit 1;

  return jsonb_build_object(
    'lead', jsonb_build_object('first_name', v_lead.first_name, 'company', v_lead.company_name),
    'settings', jsonb_build_object(
      'host_name', v_set.host_name, 'timezone', v_set.timezone, 'slot_minutes', v_set.slot_minutes,
      'working_days', v_set.working_days, 'start_hour', v_set.start_hour, 'end_hour', v_set.end_hour,
      'min_notice_hours', v_set.min_notice_hours, 'max_days_ahead', v_set.max_days_ahead,
      'meeting_details', v_set.meeting_details),
    'taken', coalesce((select jsonb_agg(start_at) from bookings
                        where status = 'confirmed' and start_at > now()
                          and start_at < now() + make_interval(days => v_set.max_days_ahead + 1)),
                      '[]'::jsonb),
    'booking', case when v_booking.id is null then null
                    else jsonb_build_object('start_at', v_booking.start_at, 'end_at', v_booking.end_at) end
  );
end;
$$;

-- Public, token-authorised: book (or move) the call. The slot is validated here,
-- not just in the page, so nobody can book off-hours by calling this directly.
create or replace function public.book_slot(p_token uuid, p_start timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead leads%rowtype;
  v_set booking_settings%rowtype;
  v_local timestamp;
  v_mins int;
  v_end timestamptz;
  v_id uuid;
begin
  select * into v_lead from leads where token = p_token for update;
  if not found or v_lead.status in ('unsubscribed', 'closed') then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into v_set from booking_settings limit 1;

  v_local := p_start at time zone v_set.timezone;
  v_mins := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;

  if extract(second from v_local) <> 0
     or not (extract(isodow from v_local)::int = any (v_set.working_days))
     or v_mins % v_set.slot_minutes <> 0
     or v_mins < v_set.start_hour * 60
     or v_mins + v_set.slot_minutes > v_set.end_hour * 60
     or p_start < now() + make_interval(hours => v_set.min_notice_hours)
     or p_start > now() + make_interval(days => v_set.max_days_ahead) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  v_end := p_start + make_interval(mins => v_set.slot_minutes);

  begin
    insert into bookings (lead_id, start_at, end_at) values (v_lead.id, p_start, v_end)
      returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end;

  -- Moving an existing booking frees the old slot.
  update bookings set status = 'cancelled', cancelled_at = now()
    where lead_id = v_lead.id and status = 'confirmed' and id <> v_id;

  update leads set status = 'booked', booked_at = now(), next_action_at = null where id = v_lead.id;

  if v_lead.prospect_id is not null then
    insert into activities (prospect_id, type, description)
      values (v_lead.prospect_id, 'CALL_BOOKED', 'Call booked for ' || to_char(v_local, 'DD Mon YYYY HH24:MI'));
  end if;
  insert into audit_logs (action, entity_type, entity_id, metadata)
    values ('CALL_BOOKED', 'lead', v_lead.id::text, jsonb_build_object('start_at', p_start));

  return jsonb_build_object('ok', true, 'booking_id', v_id, 'start_at', p_start, 'end_at', v_end,
    'email', v_lead.email, 'first_name', v_lead.first_name, 'name', v_lead.name,
    'company', v_lead.company_name, 'phone', v_lead.phone, 'message', v_lead.message,
    'timezone', v_set.timezone, 'host_name', v_set.host_name, 'host_email', v_set.host_email,
    'meeting_details', v_set.meeting_details);
end;
$$;

create or replace function public.cancel_booking(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead leads%rowtype;
  v_count int;
begin
  select * into v_lead from leads where token = p_token for update;
  if not found then
    return false;
  end if;

  update bookings set status = 'cancelled', cancelled_at = now()
    where lead_id = v_lead.id and status = 'confirmed';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return false;
  end if;

  -- Cancelling a call must not restart the emails; a person decides what's next.
  update leads set status = 'contacted', booked_at = null, next_action_at = null
    where id = v_lead.id and status = 'booked';

  if v_lead.prospect_id is not null then
    insert into activities (prospect_id, type, description)
      values (v_lead.prospect_id, 'CALL_CANCELLED', 'Booked call was cancelled');
  end if;
  insert into audit_logs (action, entity_type, entity_id)
    values ('CALL_CANCELLED', 'lead', v_lead.id::text);
  return true;
end;
$$;

-- Unsubscribe links in lead emails carry the lead's token; extend the existing
-- function so both kinds of token work.
create or replace function public.unsubscribe_by_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_prospect uuid;
  v_id uuid;
  v_inserted int;
  v_lead leads%rowtype;
begin
  select * into v_lead from leads where token = p_token;
  if found then
    insert into suppression_list (email, reason, source)
      values (lower(v_lead.email), 'Unsubscribed via email link', 'unsubscribe')
      on conflict (lower(email)) where email is not null do nothing;
    get diagnostics v_inserted = row_count;

    update leads set status = 'unsubscribed', next_action_at = null
      where id = v_lead.id and status <> 'unsubscribed';

    if v_inserted > 0 then
      if v_lead.prospect_id is not null then
        insert into activities (prospect_id, type, description)
          values (v_lead.prospect_id, 'UNSUBSCRIBED', 'Lead unsubscribed via email link');
      end if;
      insert into audit_logs (action, entity_type, entity_id, metadata)
        values ('UNSUBSCRIBED', 'lead', v_lead.id::text, jsonb_build_object('email', lower(v_lead.email)));
    end if;
    return true;
  end if;

  select id, lower(recipient_email), prospect_id
    into v_id, v_email, v_prospect
    from campaign_prospects
    where unsubscribe_token = p_token and recipient_email is not null;

  if v_email is null then
    return false;
  end if;

  insert into suppression_list (email, reason, source)
    values (v_email, 'Unsubscribed via email link', 'unsubscribe')
    on conflict (lower(email)) where email is not null do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return true;
  end if;

  insert into activities (prospect_id, type, description)
    values (v_prospect, 'UNSUBSCRIBED', 'Contact unsubscribed via email link');

  insert into audit_logs (action, entity_type, entity_id, metadata)
    values ('UNSUBSCRIBED', 'campaign_prospect', v_id::text, jsonb_build_object('email', v_email));

  return true;
end;
$$;

-- Lock down: the server-side functions are reachable through the API (it must
-- call them) but do nothing without the secret; the booking functions are
-- authorised by the lead's own token.
revoke execute on function public.lead_intake(text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.lead_claim_due(text, int) from public, anon, authenticated;
revoke execute on function public.lead_record_send(text, uuid, int, boolean, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.booking_page_data(uuid) from public, anon, authenticated;
revoke execute on function public.book_slot(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.cancel_booking(uuid) from public, anon, authenticated;
revoke execute on function public.unsubscribe_by_token(uuid) from public, anon, authenticated;

grant execute on function public.lead_intake(text, text, text, text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.lead_claim_due(text, int) to anon, authenticated;
grant execute on function public.lead_record_send(text, uuid, int, boolean, text, text, timestamptz) to anon, authenticated;
grant execute on function public.booking_page_data(uuid) to anon, authenticated;
grant execute on function public.book_slot(uuid, timestamptz) to anon, authenticated;
grant execute on function public.cancel_booking(uuid) to anon, authenticated;
grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;
