-- ============================================================
-- Objednávky VO sú vždy bez zálohy: deposit_amount = 0
-- (vedomá nula → v aplikácii „Bez zálohy")
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
    NEW.customer_name := 'Objednávka č. ' || NEW.vo_order_no;
  end if;
  return NEW;
end;
$$;

-- Doterajšie objednávky VO
update bookings
set deposit_amount = 0
where is_vo and deposit_amount is distinct from 0;
