-- ============================================================
-- Zamrazenie menu akcií, ktoré už prebehli
--  Katalóg menu sa stále mení (názvy položiek, varianty, porcie,
--  kategórie). Aby staré menu ostali také, aké boli v deň akcie,
--  databáza PRED každou zmenou katalógu (menu_categories, menu_items,
--  menu_item_variants) zapíše do výberov akcií s dátumom pred dneškom
--  (slovenský čas):
--    - názov položky, variantu a kategóriu položky (item_name,
--      variant_name, category_id),
--    - celé nastavenie kategórie (frozen_category — názov, blok, poradie,
--      porcia, jednotka, delenie, množstvá…)
--  a označí ich ako zamrazené (frozen_at). Zamrazený výber admin
--  zobrazuje a počíta len z týchto uložených údajov — ďalšie zmeny
--  katalógu ho už neovplyvnia. Dnešné a budúce menu sa menia ako doteraz.
--  Na konci sa hneď zamrazia všetky doterajšie staré menu (tak, ako
--  vyzerajú teraz).
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table booking_menu_items
  add column if not exists frozen_at       timestamptz,
  add column if not exists frozen_category jsonb;

-- Hľadajú sa len nezamrazené výbery
create index if not exists booking_menu_items_unfrozen_idx
  on booking_menu_items (booking_id) where frozen_at is null;

-- Zamrazí výbery akcií, ktoré už prebehli, podľa aktuálneho katalógu
create or replace function freeze_past_menus()
returns void
language sql
security definer
set search_path = public
as $$
  with live as (
    select s.id,
           coalesce(i.name, s.item_name)          as item_name,
           coalesce(i.category_id, s.category_id) as category_id,
           coalesce(v.name, s.variant_name)       as variant_name
    from booking_menu_items s
    join bookings b                on b.id = s.booking_id
    left join menu_items i         on i.id = s.item_id
    left join menu_item_variants v on v.id = s.variant_id
    where s.frozen_at is null
      and b.date < (now() at time zone 'Europe/Bratislava')::date
  )
  update booking_menu_items s
  set item_name       = live.item_name,
      category_id     = live.category_id,
      variant_name    = live.variant_name,
      frozen_category = to_jsonb(c),
      frozen_at       = now()
  from live
  left join menu_categories c on c.id = live.category_id
  where s.id = live.id;
$$;

revoke execute on function freeze_past_menus() from public, anon, authenticated;

-- Pred každou zmenou katalógu (úprava aj zmazanie) — raz za príkaz,
-- keď je katalóg ešte v pôvodnom stave
create or replace function freeze_past_menus_before_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform freeze_past_menus();
  return null;
end;
$$;

drop trigger if exists freeze_past_menus on menu_categories;
create trigger freeze_past_menus
  before update or delete on menu_categories
  for each statement execute function freeze_past_menus_before_catalog_change();

drop trigger if exists freeze_past_menus on menu_items;
create trigger freeze_past_menus
  before update or delete on menu_items
  for each statement execute function freeze_past_menus_before_catalog_change();

drop trigger if exists freeze_past_menus on menu_item_variants;
create trigger freeze_past_menus
  before update or delete on menu_item_variants
  for each statement execute function freeze_past_menus_before_catalog_change();

-- Hneď zamrazí všetky doterajšie staré menu
select freeze_past_menus();
