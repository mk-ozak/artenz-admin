-- ============================================================
-- Kalkulácia pre kuchyňu: pre každú kategóriu defaultné množstvo
-- na osobu + jednotka (napr. Omáčka 50 ml, Prípitok 1 ks).
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table menu_categories
  add column if not exists default_amount numeric,
  add column if not exists default_unit   text;

-- Ukážkové hodnoty (ostatné sa nastavia v Nastaveniach → Menu)
update menu_categories set default_amount = 50, default_unit = 'ml' where name ilike 'omáčka';
update menu_categories set default_amount = 1,  default_unit = 'ks' where name ilike 'prípitok';
