-- Each campaign recipient gets an unguessable capability token. Holding the
-- token is what authorises an unsubscribe, so the public endpoint needs no
-- login, no signing secret, and no service-role key.
alter table campaign_prospects
  add column recipient_email text,
  add column unsubscribe_token uuid not null default gen_random_uuid();

create unique index campaign_prospects_unsubscribe_token_idx on campaign_prospects (unsubscribe_token);

-- Called from the public unsubscribe page. SECURITY DEFINER because the
-- caller is anonymous and suppression_list is admin-only under RLS; it can
-- only ever add the one address the token was issued for.
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
begin
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

  insert into activities (prospect_id, type, description)
    values (v_prospect, 'UNSUBSCRIBED', 'Contact unsubscribed via email link');

  insert into audit_logs (action, entity_type, entity_id, metadata)
    values ('UNSUBSCRIBED', 'campaign_prospect', v_id::text, jsonb_build_object('email', v_email));

  return true;
end;
$$;

revoke execute on function public.unsubscribe_by_token(uuid) from public, anon, authenticated;
grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;
