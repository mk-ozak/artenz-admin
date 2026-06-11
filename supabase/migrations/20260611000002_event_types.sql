-- Nové typy akcií: oslava, svadba, posedenie, kar, stuzkova, firemka
-- Poradie je dôležité: najprv zrušiť starý constraint, potom premapovať dáta,
-- až nakoniec pridať nový (inak UPDATE na 'firemka' poruší ešte aktívny starý constraint).

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_event_type_check;

-- Starý typ 'firmovna' premapujeme na 'firemka'.
UPDATE bookings SET event_type = 'firemka' WHERE event_type = 'firmovna';

ALTER TABLE bookings ADD CONSTRAINT bookings_event_type_check
  CHECK (event_type IN ('oslava','svadba','posedenie','kar','stuzkova','firemka'));
