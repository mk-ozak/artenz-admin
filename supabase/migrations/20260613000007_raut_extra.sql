-- ============================================================
-- Raut navyše/menej — manuálna úprava počtu ľudí na raut
-- (môže byť kladné aj záporné číslo). „Počet ľudí na raut" sa
-- počíta automaticky a neukladá sa.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings
  add column if not exists raut_extra int;
