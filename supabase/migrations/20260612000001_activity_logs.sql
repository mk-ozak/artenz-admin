-- ============================================================
-- Logy činností používateľov
-- Trigger na bookings zachytí vytvorenie / úpravu / vymazanie /
-- obnovenie / trvalé zmazanie rezervácie vrátane autora (auth.uid()).
-- Akcie správy používateľov loguje api/users.js (service role).
-- ============================================================

create table if not exists activity_logs (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid,
  user_email text,
  action     text not null,
  entity     text,
  entity_id  uuid,
  details    jsonb
);

create index if not exists activity_logs_created_at_idx on activity_logs (created_at desc);

alter table activity_logs enable row level security;

-- Logy číta len admin; zápis ide cez security definer trigger / service role
drop policy if exists "logs_select_admin" on activity_logs;
create policy "logs_select_admin"
  on activity_logs for select
  using (is_admin());

create or replace function log_booking_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_action text;
  v_email  text;
  r        record;
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

  insert into activity_logs (user_id, user_email, action, entity, entity_id, details)
  values (
    auth.uid(),
    v_email,
    v_action,
    'booking',
    r.id,
    jsonb_build_object(
      'customer_name', r.customer_name,
      'date',          r.date,
      'hall',          r.hall,
      'status',        r.status
    )
  );
  return null;
end;
$$;

drop trigger if exists bookings_activity_log on bookings;
create trigger bookings_activity_log
  after insert or update or delete on bookings
  for each row execute procedure log_booking_activity();
