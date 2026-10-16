-- Sprint 11:
--
-- 1) HOTFIX (found while doing 2, not asked for, but urgent): the Phase 1
--    tenant-assignment trigger on `activities`/`suppression_list` requires
--    a non-authenticated caller (i.e. every SECURITY DEFINER function) to
--    supply tenant_id explicitly, or it raises. Six public-facing functions
--    never did, so as of the Phase 1 migration
--    (20260927100000_sprint9_tenancy_foundation.sql) every one of them has
--    been failing in production: a company clicking Yes/No on a permission
--    email, booking or cancelling a call, an existing-prospect website lead,
--    and the lead follow-up sender recording a sent email. Confirmed broken
--    against production before writing this fix. Each function now resolves
--    the right tenant_id from the row it already has in hand (the
--    prospect's own tenant, or the campaign_prospect's) and passes it along.
--
--    unsubscribe_by_token's lead-with-no-prospect-yet case has no tenant to
--    resolve at all -- leads doesn't carry tenant_id until leads becomes
--    tenant-owned in Phase 3 -- so it falls back to the Akani tenant, the
--    only tenant that exists today. This is a deliberate, temporary
--    simplification to revisit in Phase 3, not a permanent design decision.
--
-- 2) Audit logs become visible to platform admins only, not tenant admins
--    (explicit instruction, overriding the original plan's "tenant admins
--    read their own tenant's audit rows" -- revisit if that's wanted later).
--    New rows get tenant_id assigned the same way the Phase 1 tables do.

-- ---------------------------------------------------------------------------
-- audit_logs: tenant assignment + visibility
-- ---------------------------------------------------------------------------

-- Unlike set_tenant_id() (Phase 1), this does NOT raise when the result is
-- null: a platform admin with no tenant legitimately produces a platform
-- event (tenant_id null), which is exactly what null means on this column.
create or replace function set_audit_tenant_id() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  new.tenant_id := current_tenant_id();
  return new;
end;
$$;

create trigger audit_logs_set_tenant before insert on audit_logs
  for each row execute function set_audit_tenant_id();

drop policy "audit logs readable by admins" on audit_logs;
create policy "audit logs readable by platform admins" on audit_logs
  for select to authenticated
  using (is_platform_admin());

-- ---------------------------------------------------------------------------
-- Hotfix: resolve and pass tenant_id explicitly in every affected function
-- ---------------------------------------------------------------------------

create or replace function answer_permission(p_token uuid, p_answer text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email text;
  v_prospect uuid;
  v_prev text;
  v_first text;
  v_company text;
  v_tenant uuid;
begin
  if p_answer not in ('yes', 'no') then
    return null;
  end if;

  select cp.id, lower(cp.recipient_email), cp.prospect_id, cp.consent_answer, cp.tenant_id
    into v_id, v_email, v_prospect, v_prev, v_tenant
    from campaign_prospects cp
    where cp.unsubscribe_token = p_token and cp.recipient_email is not null;

  if v_email is null then
    return null;
  end if;

  select co.name into v_company
    from prospects p join companies co on co.id = p.company_id
    where p.id = v_prospect;

  select c.first_name into v_first
    from contacts c
    where lower(c.email) = v_email and c.first_name is not null
    limit 1;

  if v_prev is not distinct from p_answer then
    return jsonb_build_object('ok', true, 'changed', false, 'answer', p_answer,
      'email', v_email, 'first_name', v_first, 'company', v_company, 'prospect_id', v_prospect);
  end if;

  update campaign_prospects set consent_answer = p_answer, consent_at = now() where id = v_id;

  if p_answer = 'no' then
    insert into suppression_list (tenant_id, email, reason, source)
      values (v_tenant, v_email, 'Declined further contact', 'permission')
      on conflict (lower(email)) where email is not null do nothing;
  else
    delete from suppression_list where lower(email) = v_email and source = 'permission';
  end if;

  insert into activities (tenant_id, prospect_id, type, description)
    values (v_tenant, v_prospect,
            case when p_answer = 'yes' then 'PERMISSION_GRANTED' else 'PERMISSION_DECLINED' end,
            case when p_answer = 'yes' then 'Said yes to keeping in touch'
                 else 'Declined further contact' end);

  insert into audit_logs (tenant_id, action, entity_type, entity_id, metadata)
    values (v_tenant, case when p_answer = 'yes' then 'PERMISSION_GRANTED' else 'PERMISSION_DECLINED' end,
            'campaign_prospect', v_id::text, jsonb_build_object('email', v_email));

  return jsonb_build_object('ok', true, 'changed', true, 'answer', p_answer,
    'email', v_email, 'first_name', v_first, 'company', v_company, 'prospect_id', v_prospect);
end;
$$;

create or replace function book_slot(p_token uuid, p_start timestamptz) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_lead leads%rowtype;
  v_set booking_settings%rowtype;
  v_local timestamp;
  v_mins int;
  v_end timestamptz;
  v_id uuid;
  v_tenant uuid;
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

  update bookings set status = 'cancelled', cancelled_at = now()
    where lead_id = v_lead.id and status = 'confirmed' and id <> v_id;

  update leads set status = 'booked', booked_at = now(), next_action_at = null where id = v_lead.id;

  if v_lead.prospect_id is not null then
    select tenant_id into v_tenant from prospects where id = v_lead.prospect_id;
    insert into activities (tenant_id, prospect_id, type, description)
      values (v_tenant, v_lead.prospect_id, 'CALL_BOOKED', 'Call booked for ' || to_char(v_local, 'DD Mon YYYY HH24:MI'));
  end if;
  insert into audit_logs (tenant_id, action, entity_type, entity_id, metadata)
    values (v_tenant, 'CALL_BOOKED', 'lead', v_lead.id::text, jsonb_build_object('start_at', p_start));

  return jsonb_build_object('ok', true, 'booking_id', v_id, 'start_at', p_start, 'end_at', v_end,
    'email', v_lead.email, 'first_name', v_lead.first_name, 'name', v_lead.name,
    'company', v_lead.company_name, 'phone', v_lead.phone, 'message', v_lead.message,
    'timezone', v_set.timezone, 'host_name', v_set.host_name, 'host_email', v_set.host_email,
    'meeting_details', v_set.meeting_details);
end;
$$;

create or replace function cancel_booking(p_token uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_lead leads%rowtype;
  v_set booking_settings%rowtype;
  v_b bookings%rowtype;
  v_tenant uuid;
begin
  select * into v_lead from leads where token = p_token for update;
  if not found then
    return null;
  end if;

  select * into v_b from bookings
    where lead_id = v_lead.id and status = 'confirmed'
    order by start_at limit 1;
  if not found then
    return null;
  end if;

  update bookings set status = 'cancelled', cancelled_at = now()
    where lead_id = v_lead.id and status = 'confirmed';

  update leads set status = 'contacted', booked_at = null, next_action_at = null
    where id = v_lead.id and status = 'booked';

  if v_lead.prospect_id is not null then
    select tenant_id into v_tenant from prospects where id = v_lead.prospect_id;
    insert into activities (tenant_id, prospect_id, type, description)
      values (v_tenant, v_lead.prospect_id, 'CALL_CANCELLED', 'Booked call was cancelled');
  end if;
  insert into audit_logs (tenant_id, action, entity_type, entity_id)
    values (v_tenant, 'CALL_CANCELLED', 'lead', v_lead.id::text);

  select * into v_set from booking_settings limit 1;
  return jsonb_build_object('booking_id', v_b.id, 'start_at', v_b.start_at, 'end_at', v_b.end_at,
    'email', v_lead.email, 'first_name', v_lead.first_name, 'name', v_lead.name,
    'company', v_lead.company_name, 'timezone', v_set.timezone,
    'host_name', v_set.host_name, 'host_email', v_set.host_email);
end;
$$;

create or replace function unsubscribe_by_token(p_token uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_prospect uuid;
  v_id uuid;
  v_inserted int;
  v_lead leads%rowtype;
  v_tenant uuid;
begin
  select * into v_lead from leads where token = p_token;
  if found then
    if v_lead.prospect_id is not null then
      select tenant_id into v_tenant from prospects where id = v_lead.prospect_id;
    end if;
    -- A lead not yet linked to a prospect has no tenant to resolve (leads
    -- isn't tenant-owned until Phase 3); Akani is the only tenant today.
    v_tenant := coalesce(v_tenant, '11111111-1111-4111-8111-111111111111');

    insert into suppression_list (tenant_id, email, reason, source)
      values (v_tenant, lower(v_lead.email), 'Unsubscribed via email link', 'unsubscribe')
      on conflict (lower(email)) where email is not null do nothing;
    get diagnostics v_inserted = row_count;

    update leads set status = 'unsubscribed', next_action_at = null
      where id = v_lead.id and status <> 'unsubscribed';

    if v_inserted > 0 then
      if v_lead.prospect_id is not null then
        insert into activities (tenant_id, prospect_id, type, description)
          values (v_tenant, v_lead.prospect_id, 'UNSUBSCRIBED', 'Lead unsubscribed via email link');
      end if;
      insert into audit_logs (tenant_id, action, entity_type, entity_id, metadata)
        values (v_tenant, 'UNSUBSCRIBED', 'lead', v_lead.id::text, jsonb_build_object('email', lower(v_lead.email)));
    end if;
    return true;
  end if;

  select id, lower(recipient_email), prospect_id, tenant_id
    into v_id, v_email, v_prospect, v_tenant
    from campaign_prospects
    where unsubscribe_token = p_token and recipient_email is not null;

  if v_email is null then
    return false;
  end if;

  insert into suppression_list (tenant_id, email, reason, source)
    values (v_tenant, v_email, 'Unsubscribed via email link', 'unsubscribe')
    on conflict (lower(email)) where email is not null do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return true;
  end if;

  insert into activities (tenant_id, prospect_id, type, description)
    values (v_tenant, v_prospect, 'UNSUBSCRIBED', 'Contact unsubscribed via email link');

  insert into audit_logs (tenant_id, action, entity_type, entity_id, metadata)
    values (v_tenant, 'UNSUBSCRIBED', 'campaign_prospect', v_id::text, jsonb_build_object('email', v_email));

  return true;
end;
$$;

create or replace function lead_intake(
  p_secret text, p_source text, p_name text, p_email text, p_phone text,
  p_company text, p_message text, p_prospect_id uuid default null
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_existing leads%rowtype;
  v_id uuid;
  v_token uuid;
  v_first text;
  v_suppressed boolean;
  v_tenant uuid;
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
    select tenant_id into v_tenant from prospects where id = p_prospect_id;
    insert into activities (tenant_id, prospect_id, type, description)
      values (v_tenant, p_prospect_id, 'LEAD_CREATED', 'Became a lead (' || p_source || ')');
  end if;
  insert into audit_logs (tenant_id, action, entity_type, entity_id, metadata)
    values (v_tenant, 'LEAD_CREATED', 'lead', v_id::text,
            jsonb_build_object('source', p_source, 'suppressed', v_suppressed));

  return jsonb_build_object('lead_id', v_id, 'token', v_token, 'first_name', v_first,
    'company', nullif(trim(coalesce(p_company, '')), ''), 'duplicate', false,
    'suppressed', v_suppressed, 'step', 0);
end;
$$;

create or replace function lead_record_send(
  p_secret text, p_lead_id uuid, p_step integer, p_ok boolean,
  p_error text, p_subject text, p_next_at timestamptz
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_prospect uuid;
  v_tenant uuid;
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
        next_action_at = case when status in ('new', 'contacted') then p_next_at else null end
      where id = p_lead_id;
    if v_prospect is not null then
      select tenant_id into v_tenant from prospects where id = v_prospect;
      insert into activities (tenant_id, prospect_id, type, description)
        values (v_tenant, v_prospect, 'LEAD_EMAIL_SENT', 'Lead email ' || p_step || ' of 4 sent');
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
