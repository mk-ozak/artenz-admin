-- ============================================================
-- Prázdne hodnoty pre Očakávaných hostí / Predbežnú cenu / Zálohu.
--  - polia môžu byť NULL (prázdne) namiesto vynúteného 0
--  - výška zálohy: staré 0 boli len default (nie vedomé rozhodnutie),
--    prepíšu sa na NULL; reálne sumy ostávajú
-- Sémantika zálohy: NULL = nezadaná, 0 = vedome bez zálohy, >0 = suma.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings alter column expected_guests drop not null;
alter table bookings alter column expected_guests drop default;
alter table bookings alter column estimated_price drop not null;
alter table bookings alter column estimated_price drop default;

update bookings set deposit_amount = null where deposit_amount = 0;
