-- ============================================================
-- menuLuna — denné menu, trvalé menu a nastavenia pre web
-- lunacadca.sk + admin.
--  - daily_menus:    jeden riadok = jeden deň (menu_date = PK)
--  - permanent_menu: trvalá ponuka / minútky, 6 položiek (1..6)
--  - app_settings:   key-value nastavenia (gramáže, default ceny)
-- RLS: prihlásený admin = plný prístup; anon = len ČÍTANIE
--      (web lunacadca.sk číta menu cez anon kľúč).
-- Tabuľky bookings sa NEDOTÝKA.
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- Denné menu: jeden riadok = jeden deň
-- ------------------------------------------------------------
create table if not exists public.daily_menus (
  menu_date        date primary key,
  status           text not null default 'open'
                     check (status in ('open','holiday','closed')),
  note             text,                          -- napr. názov sviatku

  soup1_name       text,
  soup1_allergens  text,
  soup2_name       text default 'Vývar s rezancami/cestovinou',
  soup2_allergens  text default '1,3,9',

  main1_name       text,
  main1_allergens  text,
  main1_portion    text,                          -- napr. '160/200 g'
  main1_price      numeric(5,2),                  -- napr. 6.90

  main2_name       text,
  main2_allergens  text,
  main2_portion    text,
  main2_price      numeric(5,2),

  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Trvalé menu / minútky: bez histórie, 6 položiek
-- ------------------------------------------------------------
create table if not exists public.permanent_menu (
  position    int primary key,        -- 1..6
  name        text not null,
  allergens   text,
  portion     text,
  price       numeric(5,2),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Nastavenia (key-value)
-- ------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('portion_options',         '["160/200 g","360 g"]'),
  ('default_price_daily',     '6.90'),
  ('default_price_permanent', '8.50')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Automatické updated_at
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_daily_menus_touch on public.daily_menus;
create trigger trg_daily_menus_touch    before update on public.daily_menus
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_permanent_menu_touch on public.permanent_menu;
create trigger trg_permanent_menu_touch before update on public.permanent_menu
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_app_settings_touch on public.app_settings;
create trigger trg_app_settings_touch   before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.daily_menus    enable row level security;
alter table public.permanent_menu enable row level security;
alter table public.app_settings   enable row level security;

-- prihlásený admin = plný prístup
drop policy if exists "admin daily" on public.daily_menus;
create policy "admin daily"     on public.daily_menus    for all to authenticated using (true) with check (true);

drop policy if exists "admin permanent" on public.permanent_menu;
create policy "admin permanent" on public.permanent_menu for all to authenticated using (true) with check (true);

drop policy if exists "admin settings" on public.app_settings;
create policy "admin settings"  on public.app_settings   for all to authenticated using (true) with check (true);

-- verejné ČÍTANIE menu pre web lunacadca.sk (zápis ostáva len pre admina)
drop policy if exists "public read daily" on public.daily_menus;
create policy "public read daily"     on public.daily_menus    for select to anon using (true);

drop policy if exists "public read permanent" on public.permanent_menu;
create policy "public read permanent" on public.permanent_menu for select to anon using (true);
