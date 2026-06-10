-- ============================================================
-- Migration: profiles table + RLS policies
-- Spusti v: Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------------------------

create table if not exists profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  role        text        not null default 'read_only'
                          check (role in ('admin', 'read_only', 'customer')),
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. RLS ON PROFILES
-- ------------------------------------------------------------

alter table profiles enable row level security;

-- Každý vidí len vlastný profil
create policy "profiles_select_own"
  on profiles for select
  using (auth.uid() = id);

-- Používateľ môže editovať vlastný profil, ale NIE zmeniť rolu
create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id)
  with check (
    role = (select role from profiles where id = auth.uid())
  );

-- Admin môže meniť akýkoľvek profil vrátane role
create policy "profiles_update_admin"
  on profiles for update
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- INSERT je povolený len cez trigger (service_role) – bežný user nemôže insertiť priamo
-- (žiadna INSERT policy = blokovanie pre authenticated users)

-- ------------------------------------------------------------
-- 3. TRIGGER – automatické vytvorenie profilu po registrácii
-- ------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ------------------------------------------------------------
-- 4. BOOKINGS – pridaj user_id (placeholder pre customer záznamy)
-- ------------------------------------------------------------

alter table bookings
  add column if not exists user_id uuid references auth.users(id);

-- ------------------------------------------------------------
-- 5. BOOKINGS – zruš development policy a nastav role-based RLS
-- ------------------------------------------------------------

drop policy if exists "allow_all" on bookings;

-- Admin: plný prístup (SELECT / INSERT / UPDATE / DELETE)
create policy "bookings_admin_all"
  on bookings for all
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- read_only: len SELECT
create policy "bookings_readonly_select"
  on bookings for select
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'read_only'
    )
  );

-- customer: SELECT len vlastných záznamov (cez user_id)
create policy "bookings_customer_select_own"
  on bookings for select
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'customer'
    )
    and user_id = auth.uid()
  );
