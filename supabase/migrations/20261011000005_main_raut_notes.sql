-- ============================================================
-- Poznámky v blokoch menu Hlavné jedlo a Raut.
--   main_notes – poznámky k hlavnému jedlu
--   raut_notes – poznámky k rautu
-- Pri objednávke VO ich VO môže meniť (poistka guard_vo_order_update
-- ich nechráni, rovnako ako ostatné polia menu).
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings add column if not exists main_notes text;
alter table bookings add column if not exists raut_notes text;
