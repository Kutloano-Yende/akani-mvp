-- Leads was never tenant-scoped: it predates multi-tenancy (sprint8) and was
-- explicitly skipped by sprint9/12's tenant-isolation rollout. Its RLS
-- policy today is `using (true)` -- any authenticated user, from any
-- tenant, can read every tenant's leads. Closing that before the in-app
-- assistant gets a "how many leads" tool, so that tool isn't the one place
-- that leaks across tenants while everything else already enforces it.

alter table leads add column tenant_id uuid references tenants(id);

-- Backfill to the one real tenant in production today (same constant used
-- throughout sprint9/12).
update leads set tenant_id = '11111111-1111-4111-8111-111111111111';

create index leads_tenant_id_idx on leads (tenant_id);

drop policy "leads readable by staff" on leads;
create policy "leads readable within tenant" on leads
  for select to authenticated using (tenant_id = current_tenant_id() or is_platform_admin());

-- Write-side tenant scoping ("leads updatable by managers") is left as-is
-- -- a separate, later concern not needed for a read-only assistant tool.

-- KNOWN SIMPLIFICATION: the public intake endpoint
-- (src/app/api/public/leads/route.ts) has no per-tenant context yet -- it's
-- gated by one global shared secret, not a per-tenant one. Hardcoding the
-- one real tenant here is correct today (single real tenant actually using
-- the public form) but must be revisited before a second tenant gets its
-- own public lead form -- that's a separate, future phase, not this one.
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
                     prospect_id, status, next_action_at, tenant_id)
    values (p_source, left(trim(p_name), 120), left(v_first, 60), v_email, left(trim(p_phone), 40),
            left(trim(p_company), 160), left(trim(p_message), 2000), p_prospect_id,
            case when v_suppressed then 'unsubscribed' else 'new' end,
            case when v_suppressed then null else now() end,
            '11111111-1111-4111-8111-111111111111')
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
