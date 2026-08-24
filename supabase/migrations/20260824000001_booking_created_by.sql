-- ============================================================
-- Autor rezervácie: kto ju pridal (pre blok „Posledné pridané")
--   created_by       – uuid používateľa (auth.users)
--   created_by_name  – meno v čase vytvorenia (fallback e-mail)
-- Denormalizované meno preto, aby ho videli aj read_only používatelia
-- (profily cudzích používateľov číta cez RLS len admin).
-- ============================================================

alter table bookings
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table bookings
  add column if not exists created_by_name text;

-- ------------------------------------------------------------
-- Trigger – pri vložení doplní autora z prihláseného používateľa
-- ------------------------------------------------------------
create or replace function set_booking_created_by()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_name  text;
  v_email text;
begin
  if auth.uid() is null then
    return NEW;
  end if;

  NEW.created_by := auth.uid();

  select nullif(full_name, ''), email into v_name, v_email
  from profiles where id = auth.uid();

  NEW.created_by_name := coalesce(v_name, v_email);
  return NEW;
end;
$$;

drop trigger if exists bookings_set_created_by on bookings;
create trigger bookings_set_created_by
  before insert on bookings
  for each row execute procedure set_booking_created_by();

-- ------------------------------------------------------------
-- Doplnenie autora pre existujúce rezervácie z logov činností
-- ------------------------------------------------------------
update bookings b
set created_by      = l.user_id,
    created_by_name = coalesce(nullif(p.full_name, ''), p.email, l.user_email)
from activity_logs l
left join profiles p on p.id = l.user_id
where l.entity = 'booking'
  and l.action = 'booking_create'
  and l.entity_id = b.id
  and b.created_by is null;
