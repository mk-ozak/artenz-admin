-- Evidencia zaplatených záloh pri rezervácii.
-- deposit_payments: pole platieb [{ "date": "YYYY-MM-DD", "amount": 2500 }, …]
-- Keď existujú platby, deposit_amount drží ich súčet — zdrojom pravdy pre
-- zobrazenie zálohy (diár, exporty, SMS) zostáva deposit_amount.
alter table bookings
  add column if not exists deposit_payments jsonb not null default '[]'::jsonb;
