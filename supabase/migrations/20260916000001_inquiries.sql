-- ============================================================
-- Dopyty z webu (artenz.sk)
--
-- Samostatná tabuľka, úplne oddelená od rezervácií:
-- žiadny cudzí kľúč na bookings, žiadne prepojenie.
-- Zápis rieši VÝHRADNE Edge Function `dopyt` cez servisný kľúč,
-- ktorý RLS obchádza — rola `anon` nemá k tabuľke žiadny prístup.
-- IP adresa ani user agent sa vedome neukladajú (GDPR).
--
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABUĽKA
-- ------------------------------------------------------------

create table if not exists inquiries (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- povinné kontaktné údaje
  name          text        not null check (char_length(name)  between 1 and 120),
  phone         text        not null check (char_length(phone) between 1 and 40),
  email         text        not null check (char_length(email) between 3 and 200),

  -- akcia
  event_type    text        not null default 'ine'
                            check (event_type in (
                              'svadba', 'oslava', 'stuzkova', 'kar',
                              'firemna', 'posedenie', 'ine'
                            )),
  event_date    date,
  guests        integer     check (guests is null or (guests > 0 and guests <= 2000)),
  message       text        check (message is null or char_length(message) <= 2000),

  -- spracovanie dopytu v administrácii
  status        text        not null default 'new'
                            check (status in ('new', 'read', 'answered', 'archived', 'spam')),
  internal_note text        check (internal_note is null or char_length(internal_note) <= 4000),

  source        text        not null default 'web' check (char_length(source) <= 40)
);

-- ------------------------------------------------------------
-- 2. INDEXY
-- ------------------------------------------------------------

create index if not exists inquiries_created_at_idx on inquiries (created_at desc);
create index if not exists inquiries_status_idx     on inquiries (status);

-- ------------------------------------------------------------
-- 3. RLS
--    anon (aj verejný kľúč z webu) = žiadny prístup, ani zápis.
--    Zapisuje len Edge Function so servisným kľúčom (obchádza RLS).
-- ------------------------------------------------------------

alter table inquiries enable row level security;

-- Istota navyše k RLS: anon nemá na tabuľku ani tabuľkové práva
revoke all on table inquiries from anon;

-- Admin: čítanie, úprava aj mazanie
drop policy if exists "inquiries_admin_all" on inquiries;
create policy "inquiries_admin_all"
  on inquiries for all
  using (is_admin())
  with check (is_admin());

-- read_only: len čítanie (rovnako ako pri bookings)
-- Rola `customer` (zákazník s prístupom na /moja) nemá žiadnu policy,
-- takže k dopytom sa nedostane.
drop policy if exists "inquiries_readonly_select" on inquiries;
create policy "inquiries_readonly_select"
  on inquiries for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'read_only')
  );
