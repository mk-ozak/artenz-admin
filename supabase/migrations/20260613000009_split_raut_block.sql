-- ============================================================
-- Rozdelenie bloku 4 (Švédske stoly) na dva:
--   blok 4 = Dezert, Raut
--   blok 5 = Prílohy pre raut
--   blok 6 = Studená kuchyňa (posun z 5)
-- (Zhrnutie je za blokmi, konceptuálne blok 7.)
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

update menu_categories set block = 6 where name ilike 'studená kuchyňa';
update menu_categories set block = 5 where name ilike 'prílohy pre raut';
