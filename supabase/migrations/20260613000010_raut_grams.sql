-- ============================================================
-- Gramáž rautu na osobu (v gramoch), default 200 g.
-- Z nej sa počíta cieľová hmotnosť rautu = počet ľudí × gramáž.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings
  add column if not exists raut_grams int default 200;
