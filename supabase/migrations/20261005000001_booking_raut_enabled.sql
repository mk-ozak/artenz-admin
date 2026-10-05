-- ============================================================
-- Raut v menu rezervácie zapnutý / vypnutý (prepínač nad rautom).
-- Vypnutý raut skryje bloky Raut a Prílohy pre raut v menu,
-- kalkulácii aj tlači; vybraté položky ostávajú uložené.
-- Predvolene zapnutý — existujúce rezervácie sa nemenia.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings
  add column if not exists raut_enabled boolean not null default true;
