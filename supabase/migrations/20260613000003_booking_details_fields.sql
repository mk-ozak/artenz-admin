-- ============================================================
-- Detail rezervácie: výzdoba + rozpis počtu hostí
--  - decoration: textové pole „Výzdoba"
--  - počet hostí rozdelený na: dospelí bez špeciálov, špeciály,
--    deti s jedlom, deti bez jedla (guest_count ostáva ako legacy)
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings
  add column if not exists decoration          text,
  add column if not exists guests_adults       int,
  add column if not exists guests_specials     int,
  add column if not exists guests_kids_meal    int,
  add column if not exists guests_kids_no_meal int;
