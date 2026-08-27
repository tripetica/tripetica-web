-- Initial reservation schema for Tripetica.
-- Temporary searches are retained after conversion for analytics.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE reservation_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  browser_session_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  current_stage TEXT,
  locale TEXT NOT NULL,
  service_type TEXT NOT NULL,
  tour_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  selected_pickup_name_customer TEXT,
  selected_pickup_address_customer TEXT,
  selected_pickup_name_tr TEXT,
  selected_pickup_address_tr TEXT,
  selected_pickup_place_id TEXT,
  selected_pickup_latitude DOUBLE PRECISION,
  selected_pickup_longitude DOUBLE PRECISION,
  selected_pickup_location_type TEXT,
  selected_pickup_airport_code TEXT,

  applied_pickup_name_customer TEXT,
  applied_pickup_address_customer TEXT,
  applied_pickup_name_tr TEXT,
  applied_pickup_address_tr TEXT,
  applied_pickup_place_id TEXT,
  applied_pickup_latitude DOUBLE PRECISION,
  applied_pickup_longitude DOUBLE PRECISION,
  applied_pickup_location_type TEXT,
  applied_pickup_airport_code TEXT,

  selected_dropoff_name_customer TEXT,
  selected_dropoff_address_customer TEXT,
  selected_dropoff_name_tr TEXT,
  selected_dropoff_address_tr TEXT,
  selected_dropoff_place_id TEXT,
  selected_dropoff_latitude DOUBLE PRECISION,
  selected_dropoff_longitude DOUBLE PRECISION,
  selected_dropoff_location_type TEXT,
  selected_dropoff_airport_code TEXT,

  applied_dropoff_name_customer TEXT,
  applied_dropoff_address_customer TEXT,
  applied_dropoff_name_tr TEXT,
  applied_dropoff_address_tr TEXT,
  applied_dropoff_place_id TEXT,
  applied_dropoff_latitude DOUBLE PRECISION,
  applied_dropoff_longitude DOUBLE PRECISION,
  applied_dropoff_location_type TEXT,
  applied_dropoff_airport_code TEXT,

  selected_pickup_at TIMESTAMPTZ,
  applied_pickup_at TIMESTAMPTZ,
  service_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',

  selected_distance_km NUMERIC(10, 2),
  applied_distance_km NUMERIC(10, 2),

  selected_passenger_count INTEGER,
  applied_passenger_count INTEGER,
  selected_luggage_count INTEGER,
  applied_luggage_count INTEGER,
  selected_baby_seat_count INTEGER,
  applied_baby_seat_count INTEGER,

  selected_flight_code TEXT,
  applied_flight_code TEXT,
  selected_meet_and_greet BOOLEAN,
  applied_meet_and_greet BOOLEAN,

  selected_duration_hours NUMERIC(6, 2),
  applied_duration_hours NUMERIC(6, 2),

  selected_vehicle_code TEXT,
  applied_vehicle_code TEXT,
  selected_vehicle_label_customer TEXT,
  applied_vehicle_label_customer TEXT,
  selected_vehicle_label_tr TEXT,
  applied_vehicle_label_tr TEXT,

  selected_price NUMERIC(12, 2),
  applied_price NUMERIC(12, 2),
  currency CHAR(3),
  payment_method TEXT,

  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_country_code TEXT,
  notes TEXT,

  device_type TEXT,
  os_name TEXT,
  os_version TEXT,
  browser_name TEXT,
  browser_version TEXT,
  device_vendor TEXT,
  device_model TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  pixel_ratio NUMERIC(6, 2),
  browser_language TEXT,
  client_timezone TEXT,
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  client_context JSONB,

  CONSTRAINT reservation_searches_selected_distance_km_chk
    CHECK (selected_distance_km IS NULL OR selected_distance_km >= 0),
  CONSTRAINT reservation_searches_applied_distance_km_chk
    CHECK (applied_distance_km IS NULL OR applied_distance_km >= 0),
  CONSTRAINT reservation_searches_selected_passenger_count_chk
    CHECK (selected_passenger_count IS NULL OR selected_passenger_count >= 0),
  CONSTRAINT reservation_searches_applied_passenger_count_chk
    CHECK (applied_passenger_count IS NULL OR applied_passenger_count >= 0),
  CONSTRAINT reservation_searches_selected_luggage_count_chk
    CHECK (selected_luggage_count IS NULL OR selected_luggage_count >= 0),
  CONSTRAINT reservation_searches_applied_luggage_count_chk
    CHECK (applied_luggage_count IS NULL OR applied_luggage_count >= 0),
  CONSTRAINT reservation_searches_selected_baby_seat_count_chk
    CHECK (selected_baby_seat_count IS NULL OR selected_baby_seat_count >= 0),
  CONSTRAINT reservation_searches_applied_baby_seat_count_chk
    CHECK (applied_baby_seat_count IS NULL OR applied_baby_seat_count >= 0),
  CONSTRAINT reservation_searches_selected_duration_hours_chk
    CHECK (selected_duration_hours IS NULL OR selected_duration_hours >= 0),
  CONSTRAINT reservation_searches_applied_duration_hours_chk
    CHECK (applied_duration_hours IS NULL OR applied_duration_hours >= 0),
  CONSTRAINT reservation_searches_selected_price_chk
    CHECK (selected_price IS NULL OR selected_price >= 0),
  CONSTRAINT reservation_searches_applied_price_chk
    CHECK (applied_price IS NULL OR applied_price >= 0)
);

CREATE INDEX reservation_searches_browser_session_status_updated_idx
  ON reservation_searches (browser_session_id, status, updated_at DESC);
CREATE INDEX reservation_searches_status_idx
  ON reservation_searches (status);
CREATE INDEX reservation_searches_created_at_idx
  ON reservation_searches (created_at);
CREATE INDEX reservation_searches_service_type_idx
  ON reservation_searches (service_type);
CREATE INDEX reservation_searches_completed_at_idx
  ON reservation_searches (completed_at);

CREATE TRIGGER reservation_searches_set_updated_at
  BEFORE UPDATE ON reservation_searches
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE reservation_searches_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_search_id UUID NOT NULL
    REFERENCES reservation_searches (id)
    ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  first_name TEXT,
  last_name TEXT,
  country_code TEXT,
  gender TEXT,
  is_primary_passenger BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservation_searches_passengers_sequence_no_chk
    CHECK (sequence_no > 0),
  CONSTRAINT reservation_searches_passengers_search_sequence_key
    UNIQUE (reservation_search_id, sequence_no)
);

CREATE TRIGGER reservation_searches_passengers_set_updated_at
  BEFORE UPDATE ON reservation_searches_passengers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_code TEXT NOT NULL UNIQUE,
  source_reservation_search_id UUID UNIQUE
    REFERENCES reservation_searches (id)
    ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  locale TEXT NOT NULL,
  service_type TEXT NOT NULL,
  tour_code TEXT,

  pickup_name_customer TEXT,
  pickup_address_customer TEXT,
  pickup_name_tr TEXT,
  pickup_address_tr TEXT,
  pickup_place_id TEXT,
  pickup_latitude DOUBLE PRECISION,
  pickup_longitude DOUBLE PRECISION,
  pickup_location_type TEXT,
  pickup_airport_code TEXT,

  dropoff_name_customer TEXT,
  dropoff_address_customer TEXT,
  dropoff_name_tr TEXT,
  dropoff_address_tr TEXT,
  dropoff_place_id TEXT,
  dropoff_latitude DOUBLE PRECISION,
  dropoff_longitude DOUBLE PRECISION,
  dropoff_location_type TEXT,
  dropoff_airport_code TEXT,

  pickup_at TIMESTAMPTZ,
  service_timezone TEXT,
  distance_km NUMERIC(10, 2),
  passenger_count INTEGER,
  luggage_count INTEGER,
  baby_seat_count INTEGER,
  flight_code TEXT,
  meet_and_greet BOOLEAN,
  duration_hours NUMERIC(6, 2),

  vehicle_code TEXT,
  vehicle_label_customer TEXT,
  vehicle_label_tr TEXT,
  vehicle_description_customer TEXT,
  vehicle_description_tr TEXT,

  total_price NUMERIC(12, 2),
  currency CHAR(3),
  payment_method TEXT,

  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_country_code TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  CONSTRAINT reservations_distance_km_chk
    CHECK (distance_km IS NULL OR distance_km >= 0),
  CONSTRAINT reservations_passenger_count_chk
    CHECK (passenger_count IS NULL OR passenger_count >= 0),
  CONSTRAINT reservations_luggage_count_chk
    CHECK (luggage_count IS NULL OR luggage_count >= 0),
  CONSTRAINT reservations_baby_seat_count_chk
    CHECK (baby_seat_count IS NULL OR baby_seat_count >= 0),
  CONSTRAINT reservations_duration_hours_chk
    CHECK (duration_hours IS NULL OR duration_hours >= 0),
  CONSTRAINT reservations_total_price_chk
    CHECK (total_price IS NULL OR total_price >= 0)
);

CREATE INDEX reservations_created_at_idx ON reservations (created_at);
CREATE INDEX reservations_status_idx ON reservations (status);
CREATE INDEX reservations_service_type_idx ON reservations (service_type);
CREATE INDEX reservations_pickup_at_idx ON reservations (pickup_at);

CREATE TRIGGER reservations_set_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE reservations_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL
    REFERENCES reservations (id)
    ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  first_name TEXT,
  last_name TEXT,
  country_code TEXT,
  gender TEXT,
  is_primary_passenger BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservations_passengers_sequence_no_chk
    CHECK (sequence_no > 0),
  CONSTRAINT reservations_passengers_reservation_sequence_key
    UNIQUE (reservation_id, sequence_no)
);

CREATE TRIGGER reservations_passengers_set_updated_at
  BEFORE UPDATE ON reservations_passengers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

REVOKE ALL ON TABLE
  reservation_searches,
  reservation_searches_passengers,
  reservations,
  reservations_passengers
FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  reservation_searches,
  reservation_searches_passengers,
  reservations,
  reservations_passengers
TO tripetica_app;

GRANT USAGE ON SCHEMA public TO tripetica_app;
GRANT EXECUTE ON FUNCTION set_updated_at() TO tripetica_app;
