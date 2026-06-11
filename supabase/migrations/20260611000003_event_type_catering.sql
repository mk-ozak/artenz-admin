-- Nový typ akcie: catering
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_event_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_event_type_check
  CHECK (event_type IN ('oslava','svadba','posedenie','kar','stuzkova','firemka','catering'));
