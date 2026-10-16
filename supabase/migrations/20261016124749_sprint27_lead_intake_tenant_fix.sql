-- Forward-fix for a regression introduced in sprint24_leads_tenant_scope:
-- that migration's `create or replace function lead_intake` was written
-- from an older reference and silently dropped the tenant_id resolution
-- sprint11_audit_visibility_and_trigger_hotfix had deliberately added for
-- the activities/audit_logs inserts in the p_prospect_id branch. Those
-- inserts' tenant-assignment triggers require an explicit tenant_id from
-- any non-'authenticated' caller (which this SECURITY DEFINER function
-- always is, from the trigger's point of view) -- activities' trigger
-- raises outright; audit_logs' trigger doesn't raise but silently drops
-- tenant attribution.
--
-- While restoring that, also closes a tenant-consistency gap: an
-- explicitly supplied p_prospect_id is now rejected outright -- not
-- silently ignored -- unless it belongs to this endpoint's one authorised
-- tenant (the hardcoded Akani constant; see the KNOWN SIMPLIFICATION note
-- below). A nonexistent prospect and a cross-tenant prospect raise the
-- IDENTICAL exception, so neither leaks which case occurred. The caller
-- (src/lib/leads/db.ts's leadIntake(), and the route above it) already
-- turns any thrown error into a generic 500 with no raw Postgres message
-- exposed -- confirmed by reading that code path, not assumed -- so no
-- application-code change is needed alongside this migration.
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

  -- An explicitly supplied prospect_id is only honoured when it belongs to
  -- this endpoint's one authorised tenant -- rejected outright otherwise
  -- (never silently dropped), before any row is written. One query, one
  -- exception, so a nonexistent prospect and a cross-tenant prospect are
  -- indistinguishable to the caller.
  if p_prospect_id is not null then
    select p.tenant_id into v_tenant from prospects p
      where p.id = p_prospect_id and p.tenant_id = '11111111-1111-4111-8111-111111111111';
    if v_tenant is null then
      raise exception 'invalid prospect reference' using errcode = '22023';
    end if;
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
                     prospect_id, status, next_action_at, tenant_id)
    values (p_source, left(trim(p_name), 120), left(v_first, 60), v_email, left(trim(p_phone), 40),
            left(trim(p_company), 160), left(trim(p_message), 2000), p_prospect_id,
            case when v_suppressed then 'unsubscribed' else 'new' end,
            case when v_suppressed then null else now() end,
            '11111111-1111-4111-8111-111111111111')
    returning id, token into v_id, v_token;

  if p_prospect_id is not null then
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
