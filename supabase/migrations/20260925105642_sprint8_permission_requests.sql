-- Templates can ask "may we keep in touch?" with Yes / No buttons.
alter table email_templates
  add column include_permission_buttons boolean not null default false;

-- The recipient's answer, recorded from the button they clicked.
alter table campaign_prospects
  add column consent_answer text check (consent_answer in ('yes', 'no')),
  add column consent_at timestamptz;

-- Called from the public permission page. Like unsubscribe_by_token, the
-- per-recipient token in the email is what authorises it. A "no" adds the
-- address to the suppression list; a later "yes" lifts only a suppression this
-- same flow created (never an unsubscribe or an admin's entry).
create or replace function public.answer_permission(p_token uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text;
  v_prospect uuid;
  v_prev text;
  v_first text;
  v_company text;
begin
  if p_answer not in ('yes', 'no') then
    return null;
  end if;

  select cp.id, lower(cp.recipient_email), cp.prospect_id, cp.consent_answer
    into v_id, v_email, v_prospect, v_prev
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

  -- Same answer again (a refresh, or a scanner re-fetching): nothing to do.
  if v_prev is not distinct from p_answer then
    return jsonb_build_object('ok', true, 'changed', false, 'answer', p_answer,
      'email', v_email, 'first_name', v_first, 'company', v_company, 'prospect_id', v_prospect);
  end if;

  update campaign_prospects set consent_answer = p_answer, consent_at = now() where id = v_id;

  if p_answer = 'no' then
    insert into suppression_list (email, reason, source)
      values (v_email, 'Declined further contact', 'permission')
      on conflict (lower(email)) where email is not null do nothing;
  else
    delete from suppression_list where lower(email) = v_email and source = 'permission';
  end if;

  insert into activities (prospect_id, type, description)
    values (v_prospect,
            case when p_answer = 'yes' then 'PERMISSION_GRANTED' else 'PERMISSION_DECLINED' end,
            case when p_answer = 'yes' then 'Said yes to keeping in touch'
                 else 'Declined further contact' end);

  insert into audit_logs (action, entity_type, entity_id, metadata)
    values (case when p_answer = 'yes' then 'PERMISSION_GRANTED' else 'PERMISSION_DECLINED' end,
            'campaign_prospect', v_id::text, jsonb_build_object('email', v_email));

  return jsonb_build_object('ok', true, 'changed', true, 'answer', p_answer,
    'email', v_email, 'first_name', v_first, 'company', v_company, 'prospect_id', v_prospect);
end;
$$;

revoke execute on function public.answer_permission(uuid, text) from public, anon, authenticated;
grant execute on function public.answer_permission(uuid, text) to anon, authenticated;

-- A ready-made permission-request template. The branded layout, buttons,
-- sign-off and unsubscribe footer are added around this text when it is sent.
insert into email_templates (name, subject, body, include_permission_buttons)
values (
  'Permission to stay in touch',
  'May we stay in touch, {{firstName}}?',
  E'Hi {{firstName}},\n\nI''m reaching out from Akani. We help South African businesses like {{companyName}} understand and improve their B-BBEE position, so that more of your work qualifies for the opportunities that matter.\n\nWe''d like to send you the occasional note about how we can help. Before we do, we wanted to ask: is that okay with you?',
  true
);
