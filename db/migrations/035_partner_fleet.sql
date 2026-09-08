-- Ops partner fleet records. Additive only: no booking or partner-auth rewrite.
-- Assignment to reservations is out of scope; status + soft-delete prepare later selection.

CREATE TABLE partner_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners (id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  phone_country_code TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  deleted_by_ops_user_id UUID REFERENCES ops_users (id),
  last_edited_by_ops_user_id UUID REFERENCES ops_users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_drivers_first_name_chk
    CHECK (char_length(first_name) BETWEEN 1 AND 80),
  CONSTRAINT partner_drivers_last_name_chk
    CHECK (char_length(last_name) BETWEEN 1 AND 80),
  CONSTRAINT partner_drivers_status_chk
    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT partner_drivers_phone_country_code_chk
    CHECK (phone_country_code IS NULL OR phone_country_code ~ '^[A-Z]{2}$')
);

CREATE INDEX partner_drivers_partner_id_idx
  ON partner_drivers (partner_id)
  WHERE deleted_at IS NULL;

CREATE INDEX partner_drivers_assignable_idx
  ON partner_drivers (partner_id)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE TRIGGER partner_drivers_set_updated_at
  BEFORE UPDATE ON partner_drivers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE partner_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners (id),
  plate TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  color TEXT,
  features TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  deleted_by_ops_user_id UUID REFERENCES ops_users (id),
  last_edited_by_ops_user_id UUID REFERENCES ops_users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_vehicles_plate_chk
    CHECK (char_length(plate) BETWEEN 1 AND 24),
  CONSTRAINT partner_vehicles_brand_chk
    CHECK (brand IS NULL OR char_length(brand) BETWEEN 1 AND 80),
  CONSTRAINT partner_vehicles_model_chk
    CHECK (model IS NULL OR char_length(model) BETWEEN 1 AND 80),
  CONSTRAINT partner_vehicles_color_chk
    CHECK (color IS NULL OR char_length(color) BETWEEN 1 AND 40),
  CONSTRAINT partner_vehicles_features_chk
    CHECK (features IS NULL OR char_length(features) BETWEEN 1 AND 500),
  CONSTRAINT partner_vehicles_status_chk
    CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX partner_vehicles_partner_id_idx
  ON partner_vehicles (partner_id)
  WHERE deleted_at IS NULL;

CREATE INDEX partner_vehicles_assignable_idx
  ON partner_vehicles (partner_id)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE TRIGGER partner_vehicles_set_updated_at
  BEFORE UPDATE ON partner_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN partner_drivers.status IS
  'Ops lifecycle. Only active, non-deleted drivers may be selected for later reservation assignment.';
COMMENT ON COLUMN partner_vehicles.status IS
  'Ops lifecycle. Only active, non-deleted vehicles may be selected for later reservation assignment.';
