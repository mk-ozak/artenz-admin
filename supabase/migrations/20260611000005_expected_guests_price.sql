-- Očakávaný počet osôb a predbežná cena (default 0, platí aj pre existujúce rezervácie)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expected_guests integer NOT NULL DEFAULT 0 CHECK (expected_guests >= 0);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_price numeric NOT NULL DEFAULT 0 CHECK (estimated_price >= 0);
