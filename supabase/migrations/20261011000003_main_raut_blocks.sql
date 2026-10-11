-- ============================================================
-- Hlavné jedlo a raut ako zapínateľné bloky menu s časom podávania.
--   main_enabled – hlavné jedlo v menu (vypnuté skryje bloky 1–3:
--                  dospelí, deti, špeciály — v menu, kalkulácii aj tlači)
--   main_time    – čas podávania hlavného jedla
--   raut_time    – čas rautu
-- Čas akcie (start_time) sa už nezobrazuje ani nezadáva; doterajšie
-- časy sa presunú do času hlavného jedla (stĺpec start_time ostáva ako záloha).
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings add column if not exists main_enabled boolean not null default true;
alter table bookings add column if not exists main_time time;
alter table bookings add column if not exists raut_time time;

-- Presun času — technická zmena, do histórie rezervácií sa nezapisuje
alter table bookings disable trigger bookings_activity_log;

update bookings
set main_time = start_time
where start_time is not null and main_time is null;

alter table bookings enable trigger bookings_activity_log;
