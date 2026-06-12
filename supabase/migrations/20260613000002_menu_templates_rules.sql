-- ============================================================
-- Šablóny menu + zmena pravidiel množstva
--  - menu_templates / menu_template_items: šablóny tvorené v
--    nastaveniach rovnako ako menu rezervácie; načítanie šablóny
--    skopíruje jej položky do menu rezervácie
--  - Mäso a Príloha: bez množstva, namiesto neho podiel porcie
--    (split_portions → príznak „1/2" pri dvoch položkách)
--  - Jedlo deti a Postihovia: 1 – 20 ks (predtým 0 – 20)
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table menu_categories
  add column if not exists split_portions boolean not null default false;

update menu_categories
   set qty_min = null, qty_max = null, qty_step = null, qty_unit = null,
       split_portions = true
 where name in ('Mäso', 'Príloha');

update menu_categories
   set qty_min = 1
 where name in ('Jedlo deti', 'Postihovia');

create table if not exists menu_templates (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  created_at  timestamptz not null default now()
);

create table if not exists menu_template_items (
  id          uuid        primary key default gen_random_uuid(),
  template_id uuid        not null references menu_templates(id) on delete cascade,
  category_id uuid        not null references menu_categories(id),
  item_id     uuid        references menu_items(id) on delete set null,
  item_name   text        not null,
  quantity    numeric     not null default 1,
  created_at  timestamptz not null default now(),
  unique (template_id, item_id)
);

create index if not exists menu_template_items_template_idx
  on menu_template_items (template_id);

alter table menu_templates      enable row level security;
alter table menu_template_items enable row level security;

drop policy if exists "menu_templates_select" on menu_templates;
create policy "menu_templates_select"
  on menu_templates for select
  using (auth.uid() is not null);

drop policy if exists "menu_templates_admin_write" on menu_templates;
create policy "menu_templates_admin_write"
  on menu_templates for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "menu_template_items_select" on menu_template_items;
create policy "menu_template_items_select"
  on menu_template_items for select
  using (auth.uid() is not null);

drop policy if exists "menu_template_items_admin_write" on menu_template_items;
create policy "menu_template_items_admin_write"
  on menu_template_items for all
  using (is_admin())
  with check (is_admin());
