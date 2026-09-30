-- Detects a lead replying to a follow-up email (via an inbound-email
-- webhook, see src/app/api/webhooks/resend/inbound/route.ts), stops the
-- follow-up sequence, and records the fixed acknowledgment email sent back.
-- Authorised the same way booking/unsubscribe links already are: the lead's
-- own token, looked up inside a SECURITY DEFINER function. The webhook
-- route itself verifies the inbound request's signature before ever
-- reaching these -- the token is "which lead is this", not the security
-- boundary against strangers.

-- Idempotent: only acts on a lead still in an active follow-up state
-- ('new'/'contacted'). A lead that already booked, closed, unsubscribed,
-- or was already marked replied is left untouched -- nothing to cancel, no
-- acknowledgment to (re)send. A webhook redelivery of the same event finds
-- row_count = 0 here and reports ack_needed = false, so nothing double-sends.
create or replace function public.lead_reply_received(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_lead leads%rowtype;
  v_updated int;
  v_tenant uuid;
begin
  select * into v_lead from leads where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  update leads set status = 'replied', next_action_at = null
    where id = v_lead.id and status in ('new', 'contacted');
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('ok', true, 'ack_needed', false, 'lead_id', v_lead.id);
  end if;

  if v_lead.prospect_id is not null then
    select tenant_id into v_tenant from prospects where id = v_lead.prospect_id;
    insert into activities (tenant_id, prospect_id, type, description)
      values (v_tenant, v_lead.prospect_id, 'LEAD_REPLIED', 'Lead replied to a follow-up email');
  end if;
  insert into audit_logs (tenant_id, action, entity_type, entity_id, metadata)
    values (v_tenant, 'LEAD_REPLY_DETECTED', 'lead', v_lead.id::text, jsonb_build_object('source', 'inbound_email'));

  return jsonb_build_object('ok', true, 'ack_needed', true, 'lead_id', v_lead.id,
    'email', v_lead.email, 'first_name', v_lead.first_name, 'name', v_lead.name,
    'company', v_lead.company_name, 'token', v_lead.token, 'source', v_lead.source);
end;
$$;

-- Records the outcome of the canned (non-AI) acknowledgment send. Step 0 is
-- reserved for this (steps 1-4 are the existing follow-up sequence, see
-- lead_record_send); lead_emails.step has no check constraint, only
-- unique(lead_id, step), so this reuses the existing table/upsert idiom
-- for free observability and keeps a second call idempotent.
create or replace function public.lead_record_reply_ack(p_token uuid, p_ok boolean, p_error text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_lead leads%rowtype;
  v_tenant uuid;
begin
  select * into v_lead from leads where token = p_token;
  if not found then return; end if;

  insert into lead_emails (lead_id, step, subject, status, error)
    values (v_lead.id, 0, 'Thanks for your reply', case when p_ok then 'sent' else 'failed' end, left(p_error, 500))
    on conflict (lead_id, step) do update
      set status = excluded.status, error = excluded.error, sent_at = now();

  if v_lead.prospect_id is not null then
    select tenant_id into v_tenant from prospects where id = v_lead.prospect_id;
  end if;

  insert into audit_logs (tenant_id, action, entity_type, entity_id, metadata)
    values (v_tenant, case when p_ok then 'LEAD_REPLY_ACK_SENT' else 'LEAD_REPLY_ACK_FAILED' end,
            'lead', v_lead.id::text, jsonb_build_object('error', p_error));
end;
$$;

revoke execute on function public.lead_reply_received(uuid) from public, anon, authenticated;
revoke execute on function public.lead_record_reply_ack(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.lead_reply_received(uuid) to anon, authenticated;
grant execute on function public.lead_record_reply_ack(uuid, boolean, text) to anon, authenticated;
