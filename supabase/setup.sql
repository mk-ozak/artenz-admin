-- ============================================================
-- Artenz Admin – Supabase setup
-- Spusti v: https://supabase.com/dashboard/project/fmkralairvdhjnsfhcxo/sql/new
-- ============================================================

create table if not exists bookings (
  id             uuid primary key default gen_random_uuid(),
  date           date        not null,
  hall           text        not null check (hall in ('ARTENZ_PLUS','ARTENZ','LUNA','CATERING')),
  customer_name  text        not null,
  event_type     text        check (event_type in ('oslava','svadba','posedenie','kar','stuzkova','firemka','catering')),
  guest_count    integer     check (guest_count >= 0),
  deposit_paid   boolean     not null default false,
  deposit_amount numeric     check (deposit_amount >= 0),
  notes          text,
  created_at     timestamptz not null default now()
);

-- Enable Row Level Security
alter table bookings enable row level security;

-- Open policy – všetky operácie bez autentifikácie (pre development)
drop policy if exists "allow_all" on bookings;
create policy "allow_all" on bookings
  for all
  using (true)
  with check (true);

-- Enable Realtime
alter publication supabase_realtime add table bookings;
