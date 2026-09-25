-- Cancelling now returns the booking's details so the team can be told and the
-- lead's calendar entry removed. Null means there was nothing to cancel.
drop function public.cancel_booking(uuid);

create function public.cancel_booking(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead leads%rowtype;
  v_set booking_settings%rowtype;
  v_b bookings%rowtype;
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

  -- Cancelling a call must not restart the emails; a person decides what's next.
  update leads set status = 'contacted', booked_at = null, next_action_at = null
    where id = v_lead.id and status = 'booked';

  if v_lead.prospect_id is not null then
    insert into activities (prospect_id, type, description)
      values (v_lead.prospect_id, 'CALL_CANCELLED', 'Booked call was cancelled');
  end if;
  insert into audit_logs (action, entity_type, entity_id)
    values ('CALL_CANCELLED', 'lead', v_lead.id::text);

  select * into v_set from booking_settings limit 1;
  return jsonb_build_object('booking_id', v_b.id, 'start_at', v_b.start_at, 'end_at', v_b.end_at,
    'email', v_lead.email, 'first_name', v_lead.first_name, 'name', v_lead.name,
    'company', v_lead.company_name, 'timezone', v_set.timezone,
    'host_name', v_set.host_name, 'host_email', v_set.host_email);
end;
$$;

revoke execute on function public.cancel_booking(uuid) from public, anon, authenticated;
grant execute on function public.cancel_booking(uuid) to anon, authenticated;
