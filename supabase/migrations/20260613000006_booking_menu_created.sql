-- ============================================================
-- Príznak, či bolo pre rezerváciu vytvorené menu.
-- Prázdne menu (bez položiek) je tiež „vytvorené" — preto
-- nestačí odvodiť to z existencie položiek.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings
  add column if not exists menu_created boolean not null default false;

-- Existujúce rezervácie s nejakými menu dátami označ ako vytvorené
update bookings set menu_created = true
  where id in (select distinct booking_id from booking_menu_items)
     or guests_adults is not null
     or guests_adults_no_meal is not null
     or guests_specials is not null
     or guests_kids_meal is not null
     or guests_kids_no_meal is not null
     or notes is not null;
