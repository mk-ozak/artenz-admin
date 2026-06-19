-- ============================================================
-- Vyúčtovanie rezervácií. Nahrádza boolean „Zaplatená".
--  - zahodí deposit_paid
--  - pridá settlement_document (Bloček/Faktúra/Dohoda)
--    a settlement_method (Cash/Prevod) — nullable text, kľúče
--    v rovnakom štýle ako status (dopyt/zaloha/potvrdene)
-- „Je vyúčtované?" sa odvodzuje z settlement_document != null
-- (riadi zošednutie rezervácie v diári). Existujúce riadky → NULL.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table bookings drop column if exists deposit_paid;

alter table bookings
  add column if not exists settlement_document text,
  add column if not exists settlement_method   text;
