-- ============================================================
-- Očakávaných hostí (expected_guests) sa po vytvorení menu počítajú
-- z menu (v appke je pole zašednuté):
--   • Hlavné jedlo zapnuté:  Dospelí + Špeciály + Deti s jedlom × 0,7
--     (Dospelí bez jedla a Deti bez jedla sa nerátajú — nejedia)
--   • Len raut (bez hlavného jedla): Počet ľudí na raut — ako v menu:
--     Dospelí + Špeciály + Deti s jedlom / 2 (nahor) + Raut navyše/menej
--   • Len raut zadaný v kilách: 1 (paušál — cena na osobu = cena za celok)
--   • Ani hlavné jedlo, ani raut / bez zadaných počtov: prázdne
--     (v appke načerveno — treba skontrolovať menu)
-- Výsledok sa zaokrúhľuje na celé osoby aritmeticky (12,4 → 12; 12,5 → 13).
-- Platí do dňa akcie vrátane. Po akcii sa už neprepočítava, takže
-- počet sa dá v „Editovať rezerváciu" doladiť ručne (skutočná tržba).
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Prepočet z menu pri každom zápise rezervácie s vytvoreným menu
create or replace function set_expected_guests_from_menu()
returns trigger
language plpgsql
as $$
declare
  no_counts boolean := NEW.guests_adults is null
                   and NEW.guests_specials is null
                   and NEW.guests_kids_meal is null;
  v numeric;
begin
  if not NEW.menu_created
     or NEW.date < (now() at time zone 'Europe/Bratislava')::date then
    return NEW;
  end if;

  if NEW.main_enabled then
    -- Hlavné jedlo: deti s jedlom po 0,7
    if not no_counts then
      v := coalesce(NEW.guests_adults, 0)
         + coalesce(NEW.guests_specials, 0)
         + 0.7 * coalesce(NEW.guests_kids_meal, 0);
    end if;
  elsif NEW.raut_enabled then
    if NEW.raut_by_kg then
      -- Raut v kilách: paušál
      v := 1;
    elsif not (no_counts and NEW.raut_extra is null) then
      -- Len raut: počet ľudí na raut (rovnako ako rautTotalOf v appke)
      v := coalesce(NEW.guests_adults, 0)
         + coalesce(NEW.guests_specials, 0)
         + ceil(coalesce(NEW.guests_kids_meal, 0) / 2.0)
         + coalesce(NEW.raut_extra, 0);
    end if;
  end if;

  -- Zaokrúhlenie na celé osoby (round = aritmeticky, 0,5 nahor); záporné
  -- (raut „menej") → 0; prázdne aj 0 sa v appke ukážu načerveno
  -- (pozor: greatest(null, 0) je 0 — prázdne musí ostať prázdne)
  NEW.expected_guests := case when v is null then null else greatest(round(v), 0) end;
  return NEW;
end;
$$;

-- Názov „zz_": BEFORE triggery bežia podľa abecedy a tento musí ísť až po
-- bookings_vo_guard — ten VO nedovolí meniť expected_guests priamo, ale menu
-- VO meniť smie, takže prepočet z menu má platiť aj pri jeho úprave.
drop trigger if exists bookings_zz_expected_guests on bookings;
create trigger bookings_zz_expected_guests
  before insert or update on bookings
  for each row execute procedure set_expected_guests_from_menu();

-- 2. Doterajšie dnešné a budúce rezervácie s menu → prepočet
--    (technická zmena, do histórie sa nezapisuje; minulé sa nemenia)
alter table bookings disable trigger bookings_activity_log;

update bookings
set expected_guests = expected_guests
where menu_created
  and date >= (now() at time zone 'Europe/Bratislava')::date;

alter table bookings enable trigger bookings_activity_log;
