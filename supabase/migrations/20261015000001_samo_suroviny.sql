-- ============================================================
-- Samo-suroviny: položka menu, ktorá je sama surovinou (prípitky,
-- omáčky…), má v zozname surovín vlastný riadok naviazaný na
-- položku — v zvolenej kategórii surovín, v Nastaveniach surovín
-- zašednutý (spravuje sa z okna receptúry položky). Položka naň
-- ukazuje jedným skrytým riadkom receptúry, takže kalkulácia surovín
-- ju počíta ako bežnú surovinu vo svojej kategórii.
--  - ingredients.menu_item_id: položka, ktorej samo-surovina patrí
--    (najviac jedna na položku)
--  - premenovanie položky menu premenuje aj jej samo-surovinu
-- Migrácia iba PRIDÁVA — nič nemaže ani nepremenúva.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table ingredients
  add column if not exists menu_item_id uuid unique references menu_items(id) on delete cascade;

-- Názov samo-suroviny = názov položky menu
create or replace function sync_self_ingredient_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update ingredients set name = new.name where menu_item_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_self_ingredient_name on menu_items;
create trigger sync_self_ingredient_name
  after update of name on menu_items
  for each row execute function sync_self_ingredient_name();
