-- ============================================================
-- Správa používateľov: admin vidí všetky profily, email v profiles,
-- bezpečné odobratie zákazníka (FK on delete set null)
-- ============================================================

-- 1. is_admin() ako SECURITY DEFINER — vyhne sa rekurzii RLS na profiles
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- 2. Admin vidí všetky profily (doteraz každý videl len svoj)
drop policy if exists "profiles_select_admin" on profiles;
create policy "profiles_select_admin"
  on profiles for select
  using (is_admin());

-- (prepíš aj update policy na is_admin(), aby bola konzistentná)
drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin"
  on profiles for update
  using (is_admin());

-- 3. Email v profiles (pre zoznam používateľov v Nastaveniach)
alter table profiles add column if not exists email text;

update profiles
set email = u.email
from auth.users u
where u.id = profiles.id and profiles.email is null;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4. Zmazanie zákazníckeho účtu nesmie zlyhať na FK z bookings
alter table bookings drop constraint if exists bookings_user_id_fkey;
alter table bookings
  add constraint bookings_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
