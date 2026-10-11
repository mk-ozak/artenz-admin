-- ============================================================
-- Poznámky (decoration) sú pri objednávke VO spoločné — VO ich píše
-- vo svojej objednávke, admin ich vidí a mení v diári.
-- Poistka pri úprave objednávky VO preto Poznámky už nechráni
-- (ostatné naše interné polia áno; vo FINAL VO nezmení nič okrem stavu).
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

create or replace function guard_vo_order_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_vo_user() then
    return NEW;
  end if;

  NEW.is_vo               := OLD.is_vo;
  NEW.vo_order_no         := OLD.vo_order_no;
  NEW.hall                := OLD.hall;
  NEW.event_type          := OLD.event_type;
  NEW.status              := OLD.status;
  NEW.expected_guests     := OLD.expected_guests;
  NEW.estimated_price     := OLD.estimated_price;
  NEW.deposit_amount      := OLD.deposit_amount;
  NEW.deposit_payments    := OLD.deposit_payments;
  NEW.settlement_document := OLD.settlement_document;
  NEW.settlement_method   := OLD.settlement_method;
  NEW.user_id             := OLD.user_id;

  if OLD.vo_status = 'final'
     and (to_jsonb(NEW) - 'vo_status') is distinct from (to_jsonb(OLD) - 'vo_status') then
    raise exception 'Objednávka je FINAL — na úpravu ju najprv prepni späť na Koncept.';
  end if;
  return NEW;
end;
$$;
