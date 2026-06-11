-- Nepovinný čas rezervácie
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_time time;
