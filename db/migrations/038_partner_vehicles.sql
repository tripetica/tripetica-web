-- Partner vehicle catalog fields, approval workflow, and plate uniqueness.
-- Additive only: no booking assignment, document upload, or reservation rewrite.

ALTER TABLE partner_vehicles
  DROP CONSTRAINT partner_vehicles_status_chk;

ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_status_chk
  CHECK (status IN ('active', 'inactive', 'pending_approval', 'rejected'));

ALTER TABLE partner_vehicles
  ADD COLUMN brand_code TEXT,
  ADD COLUMN model_code TEXT,
  ADD COLUMN model_year INTEGER,
  ADD COLUMN passenger_capacity INTEGER,
  ADD COLUMN luggage_capacity INTEGER,
  ADD COLUMN vehicle_class_code TEXT,
  ADD COLUMN color_code TEXT,
  ADD COLUMN color_other TEXT,
  ADD COLUMN feature_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN feature_other TEXT,
  ADD COLUMN last_edited_by_partner_user_id UUID REFERENCES partner_users (id),
  ADD COLUMN deleted_by_partner_user_id UUID REFERENCES partner_users (id),
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN approved_by_ops_user_id UUID REFERENCES ops_users (id),
  ADD COLUMN rejected_at TIMESTAMPTZ,
  ADD COLUMN rejected_by_ops_user_id UUID REFERENCES ops_users (id);

ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_brand_code_chk
  CHECK (brand_code IS NULL OR char_length(brand_code) BETWEEN 1 AND 64);

ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_model_code_chk
  CHECK (model_code IS NULL OR char_length(model_code) BETWEEN 1 AND 80);

ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_model_year_chk
  CHECK (model_year IS NULL OR model_year BETWEEN 1970 AND 2100);

ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_passenger_capacity_chk
  CHECK (passenger_capacity IS NULL OR passenger_capacity BETWEEN 1 AND 45);

ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_luggage_capacity_chk
  CHECK (luggage_capacity IS NULL OR luggage_capacity BETWEEN 0 AND 45);

ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_class_code_chk
  CHECK (
    vehicle_class_code IS NULL
    OR vehicle_class_code IN (
      'premium-economy-sedan',
      'standard-minivan',
      'business-minivan',
      'first-class-minivan',
      'first-class-sedan',
      'minibus',
      'midibus',
      'bus'
    )
  );

ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_color_code_chk
  CHECK (color_code IS NULL OR char_length(color_code) BETWEEN 1 AND 32);

ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_color_other_chk
  CHECK (color_other IS NULL OR char_length(color_other) BETWEEN 1 AND 40);

ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_feature_other_chk
  CHECK (feature_other IS NULL OR char_length(feature_other) BETWEEN 1 AND 80);

CREATE UNIQUE INDEX partner_vehicles_plate_global_uidx
  ON partner_vehicles (lower(regexp_replace(plate, '\s+', '', 'g')))
  WHERE deleted_at IS NULL;

CREATE INDEX partner_vehicles_created_at_idx
  ON partner_vehicles (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX partner_vehicles_class_status_idx
  ON partner_vehicles (vehicle_class_code, status)
  WHERE deleted_at IS NULL;

ALTER TABLE ops_push_events
  DROP CONSTRAINT ops_push_events_type_chk;

ALTER TABLE ops_push_events
  ADD CONSTRAINT ops_push_events_type_chk
  CHECK (
    event_type IN (
      'process_created',
      'reservation_confirmed',
      'partner_application_created',
      'partner_vehicle_approval_requested'
    )
  );

COMMENT ON TABLE partner_vehicles IS
  'Partner-owned vehicles. Photos, licenses, insurance, and reservation assignment come later; keep one row per physical vehicle.';

COMMENT ON COLUMN partner_vehicles.vehicle_class_code IS
  'Canonical booking vehicle class slug from lib/booking/pricing/vehicle-quote.ts.';

COMMENT ON COLUMN partner_vehicles.passenger_capacity IS
  'Physical passenger capacity for later reservation compatibility checks.';

COMMENT ON COLUMN partner_vehicles.luggage_capacity IS
  'Physical luggage capacity for later reservation compatibility checks.';
