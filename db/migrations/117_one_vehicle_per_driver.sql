-- A vehicle may have many drivers. A driver may have at most one vehicle.
-- Existing pairing rows are not deleted or rewritten. The unique index is
-- refused when a driver already has more than one vehicle.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM partner_fleet_defaults
     GROUP BY driver_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'a driver is linked to more than one vehicle';
  END IF;
END
$$;

CREATE UNIQUE INDEX partner_fleet_defaults_one_vehicle_per_driver
  ON partner_fleet_defaults (driver_id);

COMMENT ON TABLE partner_fleet_defaults IS
  'Links a driver to at most one vehicle. A vehicle may be linked to many drivers.';
