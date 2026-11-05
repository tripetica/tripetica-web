-- One vehicle can keep several drivers, and one driver can keep several vehicles.
-- Existing pairing rows stay. This does not rewrite drivers, permissions,
-- subscriptions, U-ETDS notifications, vehicles, or GPS devices.

ALTER TABLE partner_fleet_defaults
  DROP CONSTRAINT partner_fleet_defaults_pkey;

ALTER TABLE partner_fleet_defaults
  DROP CONSTRAINT partner_fleet_defaults_vehicle_id_key;

ALTER TABLE partner_fleet_defaults
  ADD CONSTRAINT partner_fleet_defaults_pkey PRIMARY KEY (driver_id, vehicle_id);

CREATE INDEX partner_fleet_defaults_vehicle_idx
  ON partner_fleet_defaults (vehicle_id);

COMMENT ON TABLE partner_fleet_defaults IS
  'Links between one driver record and the vehicles that driver may use. A vehicle may have many drivers.';

CREATE OR REPLACE FUNCTION partner_can_access_driver(
  requested_partner_id UUID,
  requested_driver_id UUID
) RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM partner_drivers driver
     WHERE driver.id = requested_driver_id
       AND driver.deleted_at IS NULL
       AND (
         driver.partner_id = requested_partner_id
         OR EXISTS (
           SELECT 1
             FROM partner_fleet_defaults pairing
             JOIN partner_vehicle_access access
               ON access.vehicle_id = pairing.vehicle_id
            WHERE pairing.driver_id = driver.id
              AND access.partner_id = requested_partner_id
         )
       )
  )
$$;

REVOKE EXECUTE ON FUNCTION partner_can_access_driver(UUID, UUID) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT EXECUTE ON FUNCTION partner_can_access_driver(UUID, UUID) TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT EXECUTE ON FUNCTION partner_can_access_driver(UUID, UUID) TO tripetica_app;
  END IF;
END
$$;
