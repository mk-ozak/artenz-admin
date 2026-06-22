-- ============================================================
-- Farebný pásik položky menu
--  - menu_items.color: hex farba (#rrggbb) na vizuálne zoskupenie
--    položiek (napr. zemiakové prílohy); null = bez pásika
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table menu_items add column if not exists color text;
