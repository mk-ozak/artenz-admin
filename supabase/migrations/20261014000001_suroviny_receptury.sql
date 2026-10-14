-- ============================================================
-- Suroviny a receptúry — podklad pre KALKULÁCIU SUROVÍN
--  - ingredient_categories: kategórie surovín (poradie, mazanie =
--    archivácia)
--  - ingredients: suroviny s jednotkou, v ktorej sa objednávajú
--    a sčítavajú (kg / L / ks)
--  - menu_item_recipes: hlavička receptúry položky menu — dávka (na
--    koľko kg / L / ks jedla je receptúra) alebo príznak „položka je
--    sama surovinou" (napr. Cinzano — vypíše sa priamo, bez receptúry)
--  - menu_item_recipe_lines: suroviny receptúry; variant_id = navyše
--    pri danom variante (null = základ pre všetky varianty); množstvo
--    v jednotke zvolenej pri riadku (g / kg / ml / L / ks)
-- Katalóg menu (menu_items) sa nemení — úpravy receptúr preto
-- nespúšťajú zamrazenie starých menu (freeze_past_menus).
-- Migrácia iba PRIDÁVA — nič nemaže ani nepremenúva.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists ingredient_categories (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  position    int         not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists ingredients (
  id          uuid        primary key default gen_random_uuid(),
  category_id uuid        not null references ingredient_categories(id),
  name        text        not null,
  -- jednotka, v ktorej sa surovina objednáva a sčítava
  unit        text        not null default 'kg' check (unit in ('kg', 'L', 'ks')),
  position    int         not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists ingredients_category_idx on ingredients (category_id);

create table if not exists menu_item_recipes (
  item_id       uuid        primary key references menu_items(id) on delete cascade,
  -- položka je sama surovinou (napr. Cinzano) — riadky receptúry sa nepočítajú
  is_ingredient boolean     not null default false,
  -- receptúra je na yield_amount jednotiek jedla z kalkulácie (napr. na 1 kg)
  yield_amount  numeric     not null default 1 check (yield_amount > 0),
  -- jednotka jedla v čase zápisu — pri výpočte sa porovná s kalkuláciou
  yield_unit    text,
  created_at    timestamptz not null default now()
);

create table if not exists menu_item_recipe_lines (
  id            uuid        primary key default gen_random_uuid(),
  item_id       uuid        not null references menu_items(id) on delete cascade,
  -- null = základ (pre všetky varianty), inak navyše len pri tomto variante
  variant_id    uuid        references menu_item_variants(id) on delete cascade,
  ingredient_id uuid        not null references ingredients(id),
  amount        numeric     not null check (amount > 0),
  unit          text        not null check (unit in ('g', 'kg', 'ml', 'L', 'ks')),
  position      int         not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists menu_item_recipe_lines_item_idx       on menu_item_recipe_lines (item_id);
create index if not exists menu_item_recipe_lines_ingredient_idx on menu_item_recipe_lines (ingredient_id);

-- ------------------------------------------------------------
-- RLS — interné údaje kuchyne: číta admin a read_only (VO ani
-- zákazník nie), píše len admin
-- ------------------------------------------------------------

alter table ingredient_categories  enable row level security;
alter table ingredients            enable row level security;
alter table menu_item_recipes      enable row level security;
alter table menu_item_recipe_lines enable row level security;

drop policy if exists "ingredient_categories_staff_select" on ingredient_categories;
create policy "ingredient_categories_staff_select"
  on ingredient_categories for select
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'read_only')));

drop policy if exists "ingredient_categories_admin_write" on ingredient_categories;
create policy "ingredient_categories_admin_write"
  on ingredient_categories for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "ingredients_staff_select" on ingredients;
create policy "ingredients_staff_select"
  on ingredients for select
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'read_only')));

drop policy if exists "ingredients_admin_write" on ingredients;
create policy "ingredients_admin_write"
  on ingredients for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "menu_item_recipes_staff_select" on menu_item_recipes;
create policy "menu_item_recipes_staff_select"
  on menu_item_recipes for select
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'read_only')));

drop policy if exists "menu_item_recipes_admin_write" on menu_item_recipes;
create policy "menu_item_recipes_admin_write"
  on menu_item_recipes for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "menu_item_recipe_lines_staff_select" on menu_item_recipe_lines;
create policy "menu_item_recipe_lines_staff_select"
  on menu_item_recipe_lines for select
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'read_only')));

drop policy if exists "menu_item_recipe_lines_admin_write" on menu_item_recipe_lines;
create policy "menu_item_recipe_lines_admin_write"
  on menu_item_recipe_lines for all
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- Seed — 100 základných surovín v 14 kategóriách, len ak sú
-- tabuľky prázdne (ďalej sa upravujú v Nastavenia → Suroviny)
-- ------------------------------------------------------------

do $$
begin
  if exists (select 1 from ingredient_categories) then
    return;
  end if;

  insert into ingredient_categories (name, position) values
    ('Mäso',                         1),
    ('Ryby',                         2),
    ('Údeniny',                      3),
    ('Mliečne výrobky a vajcia',     4),
    ('Zelenina',                     5),
    ('Ovocie',                       6),
    ('Cestoviny, ryža a strukoviny', 7),
    ('Múka a pečivo',                8),
    ('Tuky a oleje',                 9),
    ('Koreniny a bylinky',           10),
    ('Dochucovadlá',                 11),
    ('Konzervy a sušené',            12),
    ('Mrazené',                      13),
    ('Cukor a pečenie',              14);

  insert into ingredients (category_id, name, unit, position)
  select c.id, v.name, v.unit, v.position
  from (values
    ('Mäso', 'Bravčové stehno',              'kg', 1),
    ('Mäso', 'Bravčové karé',                'kg', 2),
    ('Mäso', 'Bravčová krkovička',           'kg', 3),
    ('Mäso', 'Bravčová panenka',             'kg', 4),
    ('Mäso', 'Bravčové pliece',              'kg', 5),
    ('Mäso', 'Bravčový bôčik',               'kg', 6),
    ('Mäso', 'Bravčové rebrá',               'kg', 7),
    ('Mäso', 'Hovädzie zadné',               'kg', 8),
    ('Mäso', 'Hovädzie predné',              'kg', 9),
    ('Mäso', 'Mleté mäso (mix)',             'kg', 10),
    ('Mäso', 'Kuracie prsia',                'kg', 11),
    ('Mäso', 'Kuracie stehná vykostené',     'kg', 12),
    ('Mäso', 'Kuracie skelety (na vývar)',   'kg', 13),
    ('Mäso', 'Kačacie stehná',               'kg', 14),

    ('Ryby', 'Losos (filet)',                'kg', 1),
    ('Ryby', 'Pstruh',                       'kg', 2),

    ('Údeniny', 'Šunka dusená',              'kg', 1),
    ('Údeniny', 'Slanina údená',             'kg', 2),
    ('Údeniny', 'Klobása',                   'kg', 3),
    ('Údeniny', 'Saláma',                    'kg', 4),
    ('Údeniny', 'Údené mäso',                'kg', 5),

    ('Mliečne výrobky a vajcia', 'Vajcia',                    'ks', 1),
    ('Mliečne výrobky a vajcia', 'Mlieko',                    'L',  2),
    ('Mliečne výrobky a vajcia', 'Smotana na šľahanie 33 %',  'L',  3),
    ('Mliečne výrobky a vajcia', 'Smotana na varenie',        'L',  4),
    ('Mliečne výrobky a vajcia', 'Kyslá smotana',             'kg', 5),
    ('Mliečne výrobky a vajcia', 'Maslo',                     'kg', 6),
    ('Mliečne výrobky a vajcia', 'Tvaroh',                    'kg', 7),
    ('Mliečne výrobky a vajcia', 'Biely jogurt',              'kg', 8),
    ('Mliečne výrobky a vajcia', 'Eidam',                     'kg', 9),
    ('Mliečne výrobky a vajcia', 'Mozzarella',                'kg', 10),
    ('Mliečne výrobky a vajcia', 'Parmezán',                  'kg', 11),
    ('Mliečne výrobky a vajcia', 'Bryndza',                   'kg', 12),

    ('Zelenina', 'Zemiaky',                  'kg', 1),
    ('Zelenina', 'Cibuľa',                   'kg', 2),
    ('Zelenina', 'Cesnak',                   'kg', 3),
    ('Zelenina', 'Mrkva',                    'kg', 4),
    ('Zelenina', 'Petržlen (koreň)',         'kg', 5),
    ('Zelenina', 'Zeler',                    'kg', 6),
    ('Zelenina', 'Pór',                      'kg', 7),
    ('Zelenina', 'Kapusta biela',            'kg', 8),
    ('Zelenina', 'Kyslá kapusta',            'kg', 9),
    ('Zelenina', 'Paradajky',                'kg', 10),
    ('Zelenina', 'Uhorky šalátové',          'kg', 11),
    ('Zelenina', 'Paprika',                  'kg', 12),
    ('Zelenina', 'Šalát ľadový',             'ks', 13),
    ('Zelenina', 'Brokolica',                'kg', 14),
    ('Zelenina', 'Karfiol',                  'kg', 15),
    ('Zelenina', 'Cuketa',                   'kg', 16),
    ('Zelenina', 'Šampiňóny',                'kg', 17),
    ('Zelenina', 'Cvikla',                   'kg', 18),

    ('Ovocie', 'Citróny',                    'kg', 1),
    ('Ovocie', 'Jablká',                     'kg', 2),
    ('Ovocie', 'Pomaranče',                  'kg', 3),

    ('Cestoviny, ryža a strukoviny', 'Ryža dlhozrnná',     'kg', 1),
    ('Cestoviny, ryža a strukoviny', 'Cestoviny',          'kg', 2),
    ('Cestoviny, ryža a strukoviny', 'Polievkové rezance', 'kg', 3),
    ('Cestoviny, ryža a strukoviny', 'Tarhoňa',            'kg', 4),
    ('Cestoviny, ryža a strukoviny', 'Šošovica',           'kg', 5),
    ('Cestoviny, ryža a strukoviny', 'Fazuľa',             'kg', 6),

    ('Múka a pečivo', 'Múka hladká',         'kg', 1),
    ('Múka a pečivo', 'Múka polohrubá',      'kg', 2),
    ('Múka a pečivo', 'Múka hrubá',          'kg', 3),
    ('Múka a pečivo', 'Strúhanka',           'kg', 4),
    ('Múka a pečivo', 'Chlieb',              'kg', 5),
    ('Múka a pečivo', 'Rožky',               'ks', 6),

    ('Tuky a oleje', 'Olej slnečnicový',     'L',  1),
    ('Tuky a oleje', 'Olej olivový',         'L',  2),
    ('Tuky a oleje', 'Olej na fritovanie',   'L',  3),
    ('Tuky a oleje', 'Masť bravčová',        'kg', 4),

    ('Koreniny a bylinky', 'Soľ',                   'kg', 1),
    ('Koreniny a bylinky', 'Čierne korenie mleté',  'kg', 2),
    ('Koreniny a bylinky', 'Paprika sladká mletá',  'kg', 3),
    ('Koreniny a bylinky', 'Rasca',                 'kg', 4),
    ('Koreniny a bylinky', 'Majorán',               'kg', 5),
    ('Koreniny a bylinky', 'Bobkový list',          'kg', 6),
    ('Koreniny a bylinky', 'Nové korenie',          'kg', 7),
    ('Koreniny a bylinky', 'Rozmarín',              'kg', 8),
    ('Koreniny a bylinky', 'Kôpor',                 'kg', 9),
    ('Koreniny a bylinky', 'Petržlenová vňať',      'kg', 10),

    ('Dochucovadlá', 'Horčica',              'kg', 1),
    ('Dochucovadlá', 'Kečup',                'kg', 2),
    ('Dochucovadlá', 'Majonéza',             'kg', 3),
    ('Dochucovadlá', 'Ocot',                 'L',  4),
    ('Dochucovadlá', 'Sójová omáčka',        'L',  5),
    ('Dochucovadlá', 'Bujón',                'kg', 6),
    ('Dochucovadlá', 'Paradajkový pretlak',  'kg', 7),

    ('Konzervy a sušené', 'Kukurica sterilizovaná', 'kg', 1),
    ('Konzervy a sušené', 'Hrášok sterilizovaný',   'kg', 2),
    ('Konzervy a sušené', 'Kyslé uhorky',           'kg', 3),
    ('Konzervy a sušené', 'Sušené slivky',          'kg', 4),

    ('Mrazené', 'Hranolky',                  'kg', 1),
    ('Mrazené', 'Zeleninová zmes',           'kg', 2),
    ('Mrazené', 'Špenát',                    'kg', 3),

    ('Cukor a pečenie', 'Cukor kryštál',     'kg', 1),
    ('Cukor a pečenie', 'Cukor práškový',    'kg', 2),
    ('Cukor a pečenie', 'Cukor vanilkový',   'kg', 3),
    ('Cukor a pečenie', 'Prášok do pečiva',  'kg', 4),
    ('Cukor a pečenie', 'Droždie',           'kg', 5),
    ('Cukor a pečenie', 'Kakao',             'kg', 6)
  ) as v(category, name, unit, position)
  join ingredient_categories c on c.name = v.category;
end $$;
