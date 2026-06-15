-- ============================================================
-- Kategória „Studená kuchyňa" → blok 5
-- (Zhrnutie je za blokmi, konceptuálne blok 6.)
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

update menu_categories
   set block = 5
 where name ilike 'studená kuchyňa';
