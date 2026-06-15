-- ============================================================
-- Detail rezervácie: počet dospelých bez jedla
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings
  add column if not exists guests_adults_no_meal int;
