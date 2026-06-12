-- Pri úprave rezervácie loguj aj zoznam zmien: details->'changes'
-- = objekt { stĺpec: [stará hodnota, nová hodnota] }
create or replace function log_booking_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_action  text;
  v_email   text;
  v_details jsonb;
  v_changes jsonb;
  r         record;
begin
  if TG_OP = 'INSERT' then
    v_action := 'booking_create';
    r := NEW;
  elsif TG_OP = 'DELETE' then
    v_action := 'booking_delete';
    r := OLD;
  else
    -- technická zmena (zápis ID Google eventu) sa neloguje
    if (to_jsonb(NEW) - 'google_calendar_event_id') = (to_jsonb(OLD) - 'google_calendar_event_id') then
      return null;
    end if;
    if OLD.deleted_at is null and NEW.deleted_at is not null then
      v_action := 'booking_soft_delete';
    elsif OLD.deleted_at is not null and NEW.deleted_at is null then
      v_action := 'booking_restore';
    else
      v_action := 'booking_update';
    end if;
    r := NEW;
  end if;

  select email into v_email from profiles where id = auth.uid();

  v_details := jsonb_build_object(
    'customer_name', r.customer_name,
    'date',          r.date,
    'hall',          r.hall,
    'status',        r.status
  );

  -- Zmenené polia: { stĺpec: [stará, nová] }
  if v_action = 'booking_update' then
    select jsonb_object_agg(o.key, jsonb_build_array(o.value, n.value))
    into v_changes
    from jsonb_each(to_jsonb(OLD)) o
    join jsonb_each(to_jsonb(NEW)) n on n.key = o.key
    where o.value is distinct from n.value
      and o.key not in ('google_calendar_event_id', 'created_at', 'id', 'user_id', 'deleted_at');
    if v_changes is not null then
      v_details := v_details || jsonb_build_object('changes', v_changes);
    end if;
  end if;

  insert into activity_logs (user_id, user_email, action, entity, entity_id, details)
  values (auth.uid(), v_email, v_action, 'booking', r.id, v_details);
  return null;
end;
$$;
