-- ============================================================
-- Trvalé menu: ľubovoľný počet položiek (pridávanie, mazanie,
-- poradie ťahaním). Doteraz bola kľúčom `position` (pevne 1..6),
-- teraz má každá položka vlastné id a `position` je len poradie.
--  - pozície 1 a 2 ostávajú rezne (bravčový, kurací) – v admine
--    sa nedajú zmazať ani presunúť, PDF ich tlačí ako jeden riadok
--  - existujúce položky ani ich poradie sa nemenia, takže web
--    lunacadca.sk aj PDF fungujú ďalej aj pred nasadením nového kódu
-- Spusti v: Supabase Dashboard → SQL Editor (dá sa spustiť aj viackrát)
-- ============================================================

alter table public.permanent_menu add column if not exists id uuid not null default gen_random_uuid();

alter table public.permanent_menu drop constraint if exists permanent_menu_pkey;
alter table public.permanent_menu add constraint permanent_menu_pkey primary key (id);
alter table public.permanent_menu alter column position set not null;

-- rezne musia existovať (v ostrej databáze už sú – tu sa nič nevloží)
insert into public.permanent_menu (position, name, allergens, portion, price)
select v.position, v.name, '1,3,7', '200/200g', 8.50
from (values (1, 'Bravčový vyprážaný rezeň, zemiakový šalát'),
             (2, 'Kurací vyprážaný rezeň, zemiakový šalát')) as v(position, name)
where not exists (select 1 from public.permanent_menu p where p.position = v.position);
