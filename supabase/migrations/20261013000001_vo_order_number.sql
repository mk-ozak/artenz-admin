-- ============================================================
-- Číslo objednávky VO sa v aplikácii zobrazuje ako „RRMMDDCCC"
-- (dátum objednávky + poradové číslo vo_order_no na 3 miesta),
-- napr. 17. 10. 2026, poradie 4 → 261017004. Poradie ide ďalej
-- zo sekvencie vo_order_no_seq, v databáze sa nemení.
--
-- Názov objednávky bez mena zákazníka už nenesie číslo (to sa
-- mení s dátumom) — predvolený názov je len „Objednávka".
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

create or replace function set_vo_order_defaults()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not NEW.is_vo then
    return NEW;
  end if;
  NEW.vo_order_no    := coalesce(NEW.vo_order_no, nextval('vo_order_no_seq'));
  NEW.vo_status      := coalesce(NEW.vo_status, 'koncept');
  NEW.hall           := 'CATERING';
  NEW.event_type     := 'catering';
  NEW.status         := 'potvrdene';
  NEW.deposit_amount := 0;
  if coalesce(trim(NEW.customer_name), '') = '' then
    NEW.customer_name := 'Objednávka';
  end if;
  return NEW;
end;
$$;

-- Doterajšie predvolené názvy „Objednávka č. N" → „Objednávka"
-- (technická zmena, do histórie sa nezapisuje)
alter table bookings disable trigger bookings_activity_log;

update bookings
set customer_name = 'Objednávka'
where is_vo and customer_name ~ '^Objednávka č\. [0-9]+$';

alter table bookings enable trigger bookings_activity_log;
