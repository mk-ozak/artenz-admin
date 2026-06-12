-- ============================================================
-- MENU (jedálny lístok) pre rezervácie
--  - menu_categories: kategórie (poradie, max. počet položiek,
--    pravidlá množstva); mazanie = archivácia (archived_at)
--  - menu_items: položky kategórií; mazanie = archivácia
--  - booking_menu_items: vybraté položky pre rezerváciu so
--    snapshotom názvu (vymazanie položky neovplyvní staré menu)
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists menu_categories (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  position    int         not null default 0,
  -- max. počet položiek, ktoré sa dajú vybrať pri tvorbe menu (null = bez limitu)
  max_items   int,
  -- pravidlá množstva; qty_step null = množstvo sa nedá meniť (len výber)
  qty_min     numeric,
  qty_max     numeric,
  qty_step    numeric,
  qty_unit    text,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists menu_items (
  id          uuid        primary key default gen_random_uuid(),
  category_id uuid        not null references menu_categories(id),
  name        text        not null,
  position    int         not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists booking_menu_items (
  id          uuid        primary key default gen_random_uuid(),
  booking_id  uuid        not null references bookings(id) on delete cascade,
  category_id uuid        not null references menu_categories(id),
  item_id     uuid        references menu_items(id) on delete set null,
  -- snapshot názvu — keby sa položka v admine natvrdo zmazala
  item_name   text        not null,
  quantity    numeric     not null default 1,
  created_at  timestamptz not null default now(),
  unique (booking_id, item_id)
);

create index if not exists menu_items_category_idx       on menu_items (category_id);
create index if not exists booking_menu_items_booking_idx on booking_menu_items (booking_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table menu_categories    enable row level security;
alter table menu_items         enable row level security;
alter table booking_menu_items enable row level security;

-- Katalóg (kategórie + položky): číta každý prihlásený, píše len admin
drop policy if exists "menu_categories_select" on menu_categories;
create policy "menu_categories_select"
  on menu_categories for select
  using (auth.uid() is not null);

drop policy if exists "menu_categories_admin_write" on menu_categories;
create policy "menu_categories_admin_write"
  on menu_categories for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "menu_items_select" on menu_items;
create policy "menu_items_select"
  on menu_items for select
  using (auth.uid() is not null);

drop policy if exists "menu_items_admin_write" on menu_items;
create policy "menu_items_admin_write"
  on menu_items for all
  using (is_admin())
  with check (is_admin());

-- Menu rezervácie: admin plný prístup, read_only číta všetko,
-- zákazník číta len menu vlastnej rezervácie
drop policy if exists "booking_menu_admin_all" on booking_menu_items;
create policy "booking_menu_admin_all"
  on booking_menu_items for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "booking_menu_readonly_select" on booking_menu_items;
create policy "booking_menu_readonly_select"
  on booking_menu_items for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'read_only')
  );

drop policy if exists "booking_menu_customer_select_own" on booking_menu_items;
create policy "booking_menu_customer_select_own"
  on booking_menu_items for select
  using (
    exists (select 1 from bookings b where b.id = booking_id and b.user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- Seed — len ak sú tabuľky prázdne
-- Pravidlá množstva:
--   Prípitok / Predjedlo / Polievka / Šalát / Omáčka / Dezert → bez množstva
--   Mäso / Príloha                  → 0,5 – 1 ks (krok 0,5)
--   Jedlo deti / Postihovia         → 0 – 20 ks (krok 1)
--   Raut / Prílohy pre raut         → 0,5 – 20 kg (krok 0,5)
-- ------------------------------------------------------------

do $$
begin
  if exists (select 1 from menu_categories) then
    return;
  end if;

  insert into menu_categories (name, position, qty_min, qty_max, qty_step, qty_unit) values
    ('Prípitok',          1,  null, null, null, null),
    ('Predjedlo',         2,  null, null, null, null),
    ('Polievka',          3,  null, null, null, null),
    ('Mäso',              4,  0.5,  1,    0.5,  'ks'),
    ('Príloha',           5,  0.5,  1,    0.5,  'ks'),
    ('Šalát',             6,  null, null, null, null),
    ('Omáčka',            7,  null, null, null, null),
    ('Jedlo deti',        8,  0,    20,   1,    'ks'),
    ('Postihovia',        9,  0,    20,   1,    'ks'),
    ('Dezert',            10, null, null, null, null),
    ('Raut',              11, 0.5,  20,   0.5,  'kg'),
    ('Prílohy pre raut',  12, 0.5,  20,   0.5,  'kg');

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Prosecco',
    'Cinzano',
    'Hubert',
    'Tvrdý alkohol'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Prípitok';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Kačacia paštéta, brusnice, ozdoba, pečivo',
    'Hruška s nivovou penou, prosciutto, pečivo',
    'Lososová pena na pečive, údený losos, kôpor',
    'Špenátová roláda, pečená bagetka, ozdoba'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Predjedlo';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Vývar: kurací / hovädzí / miešaný',
    'Akákoľvek iná polievka na želanie'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Polievka';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Kuracie alebo bravčová panenka – plnené (sušená slivka, sušená paradajka, syr, šunka, oštiepok, špenát, mrkva, bazalkové pesto, kápia, niva)',
    'Kuracie alebo bravčová panenka – obaľované (sezamová krusta, rozmarínovo-orechová krusta, prosciutto, serrano šunka)',
    'Šťavnatá roláda',
    'Kurací alebo bravčový plátok',
    'Krkovička, volské oko, slaninový chips',
    'Kačacie prsia grilované',
    'Pečené stehná: kuracie, kačacie',
    'Grilovaný losos alebo pstruh',
    'Medailónky z karé',
    'Tri druhy mäska na vetvičke rozmarínu',
    'Rezeň trojobal (kurací/bravčový)',
    'Zaklepávaný rezeň',
    'Černohorský rezeň',
    'Gordon blue',
    'Sviečková na smotane',
    'Hovädzie líčka',
    'Pečené mäso',
    'Knedľa, vepřo, zelo',
    'Soté, ragú (mix)'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Mäso';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Domáca knedľa',
    'Domáca lokša',
    'Ryža',
    'Opekané zemiaky',
    'Štuchané zemiaky so slaninkou a cibuľou',
    'Hranolky',
    'Dukáty',
    'Americké zemiaky',
    'Krúpy',
    'Pyré: batatové, zelerové, hrachové, mrkvové',
    'Tarhoňa',
    'Dusená kapusta: biela / červená klasik / sladká'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Príloha';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Trhaný šalát s cherry paradajkami a dresingom',
    'Taliansky šalát',
    'Listový so zálievkou',
    'Mrkvový',
    'Kapustový',
    'Cviklový',
    'Coleslaw',
    'Parená zelenina'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Šalát';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Klasický výpek',
    'Slaninková',
    'Dubáková',
    'Šampiňónová',
    'Syrová',
    'Slivková',
    'Brusnicová',
    'Dijon',
    'Štvorfarebné korenie',
    'Zelené korenie',
    'Rozmarín',
    'Medvedí cesnak'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Omáčka';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Syr a hranolky'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Jedlo deti';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Medvedí cesnak'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Postihovia';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Bábovka'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Dezert';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Rezne: kuracie / bravčové / vykostené stehná v trojobale alebo cestíčku',
    'Grilované kuracie nožky',
    'Koleno (svieže)',
    'Marinovaný krk: BBQ / klasik',
    'Fašírky z mletého mäsa',
    'Jednohubky: kuracie, plnená cuketka',
    'Roládky mix',
    'Bravčové vypečky',
    'Placky so soté',
    'Zabíjačkový tanier',
    'Rebrá pečené',
    'Mäsový bôčik',
    'Tortilky',
    'Špízy',
    'Hamburgeríky',
    'Pečené prasiatko',
    'Soté mix',
    'Zapekané medailónky so syrom, paradajkou, mozzarellou, cherry',
    'Vyprážané: enciány, eidam, karfiol, šampiňóny',
    'Šunkovo-syrové misy',
    'Grilovaná zelenina',
    'Šampiňóny',
    'Kapustnica',
    'Boršč',
    'Guláš: hovädzí / bravčový',
    'Ryba',
    'Tatársky biftek',
    'Kačka',
    'Losos',
    'Pirohy',
    'Šúľance',
    'Halušky'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Raut';

  insert into menu_items (category_id, name, position)
  select c.id, t.name, t.ord
  from menu_categories c
  join lateral unnest(array[
    'Zemiakový',
    'Cestovinový',
    'Salámový pikant',
    'Šopský',
    'Vlašský',
    'Parížsky',
    'Coleslaw',
    'Pórkový',
    'Cviklový',
    'Zelerový s ananásom',
    'Ovocný',
    'Pečené zemiaky',
    'Americké zemiaky',
    'Dusená ryža',
    'Pečivo',
    'Baranie rohy',
    'Kyslá uhorka'
  ]) with ordinality as t(name, ord) on true
  where c.name = 'Prílohy pre raut';
end $$;
