-- Driver Task public visibility flags. Additive. Defaults stay hidden.
-- Does not rewrite tokens, stages, or reservation rows.

ALTER TABLE reservation_driver_tasks
  ADD COLUMN show_price_info BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN show_passenger_contact BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN reservation_driver_tasks.show_price_info IS
  'When true, public Driver Task may show customer price/FX already stored on the reservation.';
COMMENT ON COLUMN reservation_driver_tasks.show_passenger_contact IS
  'When true, public Driver Task may show reservation phone/email.';
