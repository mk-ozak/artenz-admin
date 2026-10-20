-- ============================================================
-- Raut zadaný v kilách — prepínač „ZADAŤ KILÁ" v bloku Raut s prílohami.
--   raut_by_kg – raut sa nepočíta z počtu ľudí × gramáž, ale zadá sa
--                rovno celková hmotnosť (predvolene vypnuté = ako doteraz)
--   raut_kg    – celková hmotnosť rautu v kg
-- Počet ľudí navyše/menej a gramáž ostávajú uložené (po vypnutí sa vrátia).
-- Pri objednávke VO ich VO v appke nemení (zašednuté ako gramáž rautu);
-- poistka guard_vo_order_update ich nechráni, rovnako ako gramáž.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings add column if not exists raut_by_kg boolean not null default false;
alter table bookings add column if not exists raut_kg numeric;
