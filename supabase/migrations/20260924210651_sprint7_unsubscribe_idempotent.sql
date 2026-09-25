-- Repeat clicks (or a mail client retrying the one-click POST) must be a
-- harmless no-op, not extra activity and audit rows.
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

revoke execute on function public.unsubscribe_by_token(uuid) from public, anon, authenticated;
grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;
