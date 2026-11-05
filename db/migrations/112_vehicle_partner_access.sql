-- A vehicle stays a single fleet record while Ops may grant equal access to
-- one or more partners. partner_vehicles.partner_id remains immutable creator /
-- billing provenance and is not an authorization boundary after this migration.

CREATE TABLE partner_vehicle_access (
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners (id),
  uetds_company_id UUID REFERENCES uetds_companies (id) ON DELETE SET NULL,
  granted_by_ops_user_id UUID REFERENCES ops_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vehicle_id, partner_id)
);

CREATE INDEX partner_vehicle_access_partner_idx
  ON partner_vehicle_access (partner_id, vehicle_id);

CREATE INDEX partner_vehicle_access_company_idx
  ON partner_vehicle_access (uetds_company_id)
  WHERE uetds_company_id IS NOT NULL;

CREATE TRIGGER partner_vehicle_access_set_updated_at
  BEFORE UPDATE ON partner_vehicle_access
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

INSERT INTO partner_vehicle_access (vehicle_id, partner_id, uetds_company_id)
SELECT id, partner_id, uetds_company_id
FROM partner_vehicles
ON CONFLICT (vehicle_id, partner_id) DO NOTHING;

CREATE TABLE partner_vehicle_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id),
  partner_id UUID NOT NULL REFERENCES partners (id),
  action TEXT NOT NULL,
  old_uetds_company_id UUID REFERENCES uetds_companies (id) ON DELETE SET NULL,
  new_uetds_company_id UUID REFERENCES uetds_companies (id) ON DELETE SET NULL,
  actor_ops_user_id UUID REFERENCES ops_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_vehicle_access_audit_action_chk
    CHECK (action IN ('grant', 'revoke', 'company_change'))
);

CREATE INDEX partner_vehicle_access_audit_vehicle_idx
  ON partner_vehicle_access_audit (vehicle_id, created_at DESC);

CREATE OR REPLACE FUNCTION partner_vehicle_access_keep_one()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow a physical parent delete to cascade, but never leave a live vehicle
  -- without an authorized partner.
  IF EXISTS (SELECT 1 FROM partner_vehicles WHERE id = OLD.vehicle_id)
     AND NOT EXISTS (
       SELECT 1
       FROM partner_vehicle_access access
       WHERE access.vehicle_id = OLD.vehicle_id
         AND access.partner_id <> OLD.partner_id
     ) THEN
    RAISE EXCEPTION 'vehicle_requires_authorized_partner'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END
$$;

CREATE TRIGGER partner_vehicle_access_keep_one
  BEFORE DELETE ON partner_vehicle_access
  FOR EACH ROW
  EXECUTE FUNCTION partner_vehicle_access_keep_one();

CREATE OR REPLACE FUNCTION partner_can_access_vehicle(
  requested_partner_id UUID,
  requested_vehicle_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM partner_vehicle_access access
    JOIN partner_vehicles vehicle ON vehicle.id = access.vehicle_id
    JOIN partners partner ON partner.id = access.partner_id
    WHERE access.vehicle_id = requested_vehicle_id
      AND access.partner_id = requested_partner_id
      AND vehicle.deleted_at IS NULL
      AND partner.deleted_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION partner_can_access_driver(
  requested_partner_id UUID,
  requested_driver_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM partner_drivers driver
    LEFT JOIN partner_fleet_defaults pairing ON pairing.driver_id = driver.id
    WHERE driver.id = requested_driver_id
      AND driver.deleted_at IS NULL
      AND (
        (
          pairing.vehicle_id IS NOT NULL
          AND partner_can_access_vehicle(requested_partner_id, pairing.vehicle_id)
        )
        OR (
          pairing.vehicle_id IS NULL
          AND driver.partner_id = requested_partner_id
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION partner_can_access_gps_device(
  requested_partner_id UUID,
  requested_device_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM gps_devices device
    WHERE device.id = requested_device_id
      AND device.deleted_at IS NULL
      AND (
        (
          device.vehicle_id IS NOT NULL
          AND partner_can_access_vehicle(requested_partner_id, device.vehicle_id)
        )
        OR (
          device.vehicle_id IS NULL
          AND device.partner_id = requested_partner_id
        )
      )
  )
$$;

COMMENT ON TABLE partner_vehicle_access IS
  'Equal partner authorization grants for one shared vehicle record. Creator provenance remains on partner_vehicles.partner_id.';
COMMENT ON COLUMN partner_vehicle_access.uetds_company_id IS
  'Partner-specific carrier company used when this partner selects the shared vehicle or its linked driver in U-ETDS.';
COMMENT ON TABLE partner_vehicle_access_audit IS
  'Append-only Ops audit for vehicle authorization and partner-specific U-ETDS company changes.';

REVOKE ALL ON TABLE partner_vehicle_access FROM PUBLIC;
REVOKE ALL ON TABLE partner_vehicle_access_audit FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION partner_can_access_vehicle(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION partner_can_access_driver(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION partner_can_access_gps_device(UUID, UUID) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_vehicle_access TO tripetica_dev_app;
    GRANT SELECT, INSERT ON TABLE partner_vehicle_access_audit TO tripetica_dev_app;
    GRANT EXECUTE ON FUNCTION partner_can_access_vehicle(UUID, UUID) TO tripetica_dev_app;
    GRANT EXECUTE ON FUNCTION partner_can_access_driver(UUID, UUID) TO tripetica_dev_app;
    GRANT EXECUTE ON FUNCTION partner_can_access_gps_device(UUID, UUID) TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_vehicle_access TO tripetica_app;
    GRANT SELECT, INSERT ON TABLE partner_vehicle_access_audit TO tripetica_app;
    GRANT EXECUTE ON FUNCTION partner_can_access_vehicle(UUID, UUID) TO tripetica_app;
    GRANT EXECUTE ON FUNCTION partner_can_access_driver(UUID, UUID) TO tripetica_app;
    GRANT EXECUTE ON FUNCTION partner_can_access_gps_device(UUID, UUID) TO tripetica_app;
  END IF;
END
$$;
