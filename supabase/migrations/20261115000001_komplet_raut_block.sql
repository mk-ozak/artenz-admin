-- ============================================================
-- Nové poradie blokov za rautom:
--   blok 6 = Komplet jedlo v raute (kategória už v bloku 6 je)
--   blok 7 = Studená kuchyňa (posun zo 6)
-- Aplikácia rozlišuje bloky podľa čísla (6 sa skryje s vypnutým
-- rautom, 7 má na termo tlači vlastný lístok za rezom), preto sa
-- blok 7 prepíše aj v zamrazených starých menu (frozen_category) —
-- inak by sa ich studená kuchyňa zobrazila ako Komplet jedlo v raute.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

begin;

-- 1. Studená kuchyňa → blok 7 (trigger pred zmenou katalógu najprv
--    zamrazí ešte nezamrazené staré menu — ešte s blokom 6)
update menu_categories
   set block = 7, position = 1
 where id = 'a9a018b8-11cb-4bf3-b193-75146e674d6e';  -- Studená kuchyňa

-- 2. Zamrazené staré menu: studená kuchyňa tiež v bloku 7
update booking_menu_items
   set frozen_category = jsonb_set(frozen_category, '{block}', '7'::jsonb)
 where frozen_at is not null
   and frozen_category->>'id' = 'a9a018b8-11cb-4bf3-b193-75146e674d6e'
   and frozen_category->>'block' = '6';

commit;

-- Kontrola (má vrátiť Komplet jedlo v raute v bloku 6, Studená kuchyňa v 7
-- a žiadny zamrazený výber studenej kuchyne v bloku 6):
-- select block, name from menu_categories where block >= 6 order by block, position;
-- select count(*) from booking_menu_items
--  where frozen_category->>'name' ilike 'studená kuchyňa' and frozen_category->>'block' = '6';
