-- ============================================================
-- Varianty (podkategórie) položiek menu — napr. Náplň / Obal
--  - menu_items.has_variants       → „zaklikávatko" na položke
--  - menu_items.variant_group_name → názov skupiny („Náplň", „Obal")
--  - menu_item_variants            → možnosti variantu (poradie,
--    mazanie = archivácia ako pri položkách)
--  - booking_menu_items / menu_template_items: variant_id +
--    variant_name (snapshot názvu, rovnaký vzor ako item_name)
-- Výber variantu je vždy práve jeden a je povinný — kontroluje
-- to UI, nie DB (nedokončený výber sa dá rozpracovať a doplniť).
-- Migrácia iba PRIDÁVA — nič nemaže ani nepremenúva, takže
-- existujúce jedálne lístky ostávajú nedotknuté.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

alter table menu_items
  add column if not exists has_variants       boolean not null default false,
  add column if not exists variant_group_name text;

create table if not exists menu_item_variants (
  id          uuid        primary key default gen_random_uuid(),
  item_id     uuid        not null references menu_items(id) on delete cascade,
  name        text        not null,
  position    int         not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists menu_item_variants_item_idx on menu_item_variants (item_id);

-- Zvolený variant vo výbere; snapshot názvu prežije aj archiváciu možnosti
alter table booking_menu_items
  add column if not exists variant_id   uuid references menu_item_variants(id) on delete set null,
  add column if not exists variant_name text;

alter table menu_template_items
  add column if not exists variant_id   uuid references menu_item_variants(id) on delete set null,
  add column if not exists variant_name text;

-- ------------------------------------------------------------
-- RLS — presne ako pri menu_items: číta každý prihlásený,
-- píše len admin
-- ------------------------------------------------------------

alter table menu_item_variants enable row level security;

drop policy if exists "menu_item_variants_select" on menu_item_variants;
create policy "menu_item_variants_select"
  on menu_item_variants for select
  using (auth.uid() is not null);

drop policy if exists "menu_item_variants_admin_write" on menu_item_variants;
create policy "menu_item_variants_admin_write"
  on menu_item_variants for all
  using (is_admin())
  with check (is_admin());
