-- ============================================================
-- Objednávky VO (veľkoobchod) — odberateľ, ktorý si berie jedlo
-- do svojej sály. Objednávka = riadok v bookings s is_vo = true
-- (menu, logy, diár a lístky fungujú ako pri rezervácii).
--   is_vo        – príznak objednávky VO
--   vo_order_no  – poradové číslo objednávky (1, 2, 3 …)
--   vo_status    – 'koncept' | 'final' (FINAL zamkne objednávku pre VO)
-- Rola 'vo' vidí len objednávky VO, nič iné z administrácie.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. Rola 'vo'
-- ------------------------------------------------------------
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table profiles drop constraint %I', c);
  end loop;
end $$;

alter table profiles
  add constraint profiles_role_check
  check (role in ('admin', 'read_only', 'customer', 'vo'));

create or replace function public.is_vo_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'vo')
$$;

-- ------------------------------------------------------------
-- 2. Stĺpce objednávky
-- ------------------------------------------------------------
alter table bookings add column if not exists is_vo boolean not null default false;
alter table bookings add column if not exists vo_order_no integer unique;
alter table bookings add column if not exists vo_status text
  check (vo_status in ('koncept', 'final'));

create sequence if not exists vo_order_no_seq;

-- ------------------------------------------------------------
-- 3. Nová objednávka: číslo, stav Koncept, sála CATERING,
--    prázdny názov → „Objednávka č. N"
-- ------------------------------------------------------------
create or replace function set_vo_order_defaults()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not NEW.is_vo then
    return NEW;
  end if;
  NEW.vo_order_no := coalesce(NEW.vo_order_no, nextval('vo_order_no_seq'));
  NEW.vo_status   := coalesce(NEW.vo_status, 'koncept');
  NEW.hall        := 'CATERING';
  NEW.event_type  := 'catering';
  NEW.status      := 'potvrdene';
  if coalesce(trim(NEW.customer_name), '') = '' then
    NEW.customer_name := 'Objednávka č. ' || NEW.vo_order_no;
  end if;
  return NEW;
end;
$$;

drop trigger if exists bookings_vo_defaults on bookings;
create trigger bookings_vo_defaults
  before insert on bookings
  for each row execute procedure set_vo_order_defaults();

-- ------------------------------------------------------------
-- 4. Úprava objednávky VO používateľom:
--    – naše interné polia (cena, záloha, poznámky, sála…) nezmení
--    – vo FINAL smie zmeniť len stav (späť na Koncept)
-- ------------------------------------------------------------
create or replace function guard_vo_order_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_vo_user() then
    return NEW;
  end if;

  NEW.is_vo               := OLD.is_vo;
  NEW.vo_order_no         := OLD.vo_order_no;
  NEW.hall                := OLD.hall;
  NEW.event_type          := OLD.event_type;
  NEW.status              := OLD.status;
  NEW.expected_guests     := OLD.expected_guests;
  NEW.estimated_price     := OLD.estimated_price;
  NEW.deposit_amount      := OLD.deposit_amount;
  NEW.deposit_payments    := OLD.deposit_payments;
  NEW.settlement_document := OLD.settlement_document;
  NEW.settlement_method   := OLD.settlement_method;
  NEW.decoration          := OLD.decoration;
  NEW.user_id             := OLD.user_id;

  if OLD.vo_status = 'final'
     and (to_jsonb(NEW) - 'vo_status') is distinct from (to_jsonb(OLD) - 'vo_status') then
    raise exception 'Objednávka je FINAL — na úpravu ju najprv prepni späť na Koncept.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists bookings_vo_guard on bookings;
create trigger bookings_vo_guard
  before update on bookings
  for each row execute procedure guard_vo_order_update();

-- ------------------------------------------------------------
-- 5. RLS bookings — VO vidí, pridáva a upravuje len objednávky VO
--    (mazanie = soft delete cez deleted_at, teda update)
-- ------------------------------------------------------------
drop policy if exists "bookings_vo_select" on bookings;
create policy "bookings_vo_select"
  on bookings for select
  using (is_vo_user() and is_vo);

drop policy if exists "bookings_vo_insert" on bookings;
create policy "bookings_vo_insert"
  on bookings for insert
  with check (is_vo_user() and is_vo);

drop policy if exists "bookings_vo_update" on bookings;
create policy "bookings_vo_update"
  on bookings for update
  using (is_vo_user() and is_vo)
  with check (is_vo_user() and is_vo);

-- ------------------------------------------------------------
-- 6. RLS booking_menu_items — VO číta menu objednávok VO,
--    meniť ho smie len v stave Koncept
-- ------------------------------------------------------------
drop policy if exists "booking_menu_vo_select" on booking_menu_items;
create policy "booking_menu_vo_select"
  on booking_menu_items for select
  using (
    is_vo_user()
    and exists (select 1 from bookings b where b.id = booking_id and b.is_vo)
  );

drop policy if exists "booking_menu_vo_insert" on booking_menu_items;
create policy "booking_menu_vo_insert"
  on booking_menu_items for insert
  with check (
    is_vo_user()
    and exists (select 1 from bookings b
                where b.id = booking_id and b.is_vo
                  and b.vo_status = 'koncept' and b.deleted_at is null)
  );

drop policy if exists "booking_menu_vo_update" on booking_menu_items;
create policy "booking_menu_vo_update"
  on booking_menu_items for update
  using (
    is_vo_user()
    and exists (select 1 from bookings b
                where b.id = booking_id and b.is_vo
                  and b.vo_status = 'koncept' and b.deleted_at is null)
  )
  with check (
    is_vo_user()
    and exists (select 1 from bookings b
                where b.id = booking_id and b.is_vo
                  and b.vo_status = 'koncept' and b.deleted_at is null)
  );

drop policy if exists "booking_menu_vo_delete" on booking_menu_items;
create policy "booking_menu_vo_delete"
  on booking_menu_items for delete
  using (
    is_vo_user()
    and exists (select 1 from bookings b
                where b.id = booking_id and b.is_vo
                  and b.vo_status = 'koncept' and b.deleted_at is null)
  );

-- ------------------------------------------------------------
-- 7. Logy — meno autora priamo v logu (VO nevidí cudzie profily),
--    číslo objednávky VO v details; VO číta len logy objednávok VO
-- ------------------------------------------------------------
alter table activity_logs add column if not exists user_name text;

create or replace function log_booking_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_action  text;
  v_email   text;
  v_name    text;
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

  select email, nullif(full_name, '') into v_email, v_name from profiles where id = auth.uid();

  v_details := jsonb_build_object(
    'customer_name', r.customer_name,
    'date',          r.date,
    'hall',          r.hall,
    'status',        r.status
  );
  if r.is_vo then
    v_details := v_details || jsonb_build_object('vo_order_no', r.vo_order_no);
  end if;

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

  insert into activity_logs (user_id, user_email, user_name, action, entity, entity_id, details)
  values (auth.uid(), v_email, coalesce(v_name, v_email), v_action, 'booking', r.id, v_details);
  return null;
end;
$$;

drop policy if exists "logs_select_vo" on activity_logs;
create policy "logs_select_vo"
  on activity_logs for select
  using (
    is_vo_user()
    and entity = 'booking'
    and exists (select 1 from bookings b where b.id = entity_id and b.is_vo)
  );

-- ------------------------------------------------------------
-- 8. Menu Luna — len admin a read_only (VO ani zákazník nemajú
--    žiadny prístup, ani na čítanie). Verejné čítanie pre web ostáva.
-- ------------------------------------------------------------
drop policy if exists "admin daily" on public.daily_menus;
create policy "admin daily" on public.daily_menus for all to authenticated
  using      (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'read_only')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'read_only')));

drop policy if exists "admin permanent" on public.permanent_menu;
create policy "admin permanent" on public.permanent_menu for all to authenticated
  using      (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'read_only')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'read_only')));

drop policy if exists "admin settings" on public.app_settings;
create policy "admin settings" on public.app_settings for all to authenticated
  using      (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'read_only')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'read_only')));
