-- ============================================================
-- Bloky kategórií menu — kategórie sa zoskupujú do blokov,
-- medzi blokmi sa v menu zobrazuje oddeľovač. Kategórie sa
-- dajú presúvať medzi blokmi (stĺpec block).
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table menu_categories
  add column if not exists block smallint not null default 1;

-- Počiatočné rozdelenie do 4 blokov (oddeľovače medzi:
-- Šalát|Jedlo deti, Jedlo deti|Postihovia, Postihovia|Dezert)
update menu_categories set block = 1
  where name in ('Prípitok', 'Predjedlo', 'Polievka', 'Mäso', 'Príloha', 'Šalát', 'Omáčka');
update menu_categories set block = 2 where name = 'Jedlo deti';
update menu_categories set block = 3 where name = 'Postihovia';
update menu_categories set block = 4
  where name in ('Dezert', 'Raut', 'Prílohy pre raut');
