-- One pairing row is the only Şoför ↔ Araç default.
-- A driver has at most one default vehicle (PRIMARY KEY driver_id).
-- A vehicle has at most one default driver (UNIQUE vehicle_id).
-- Existing fleet rows are not backfilled.

CREATE TABLE partner_fleet_defaults (
  partner_id UUID NOT NULL REFERENCES partners (id),
  driver_id UUID NOT NULL REFERENCES partner_drivers (id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (driver_id),
  UNIQUE (vehicle_id)
);

CREATE INDEX partner_fleet_defaults_partner_idx
  ON partner_fleet_defaults (partner_id);

COMMENT ON TABLE partner_fleet_defaults IS
  'Single default pairing between one partner driver and one partner vehicle.';

ALTER TABLE partner_drivers
  ADD COLUMN default_edevlet_authority_id UUID
    REFERENCES partner_uetds_authorities (id) ON DELETE SET NULL;

CREATE INDEX partner_drivers_default_edevlet_authority_idx
  ON partner_drivers (default_edevlet_authority_id);

COMMENT ON COLUMN partner_drivers.default_edevlet_authority_id IS
  'Optional default e-Devlet authority for this driver. One authority may be the default for many drivers.';

REVOKE ALL ON TABLE partner_fleet_defaults FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_fleet_defaults TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_fleet_defaults TO tripetica_app;
  END IF;
END
$$;
