-- Pin lookup functions to the application schema and keep them unavailable to
-- PUBLIC even when a prior CREATE OR REPLACE preserved environment defaults.

ALTER FUNCTION partner_can_access_vehicle(UUID, UUID)
  SET search_path = public, pg_temp;
ALTER FUNCTION partner_can_access_driver(UUID, UUID)
  SET search_path = public, pg_temp;
ALTER FUNCTION partner_can_access_gps_device(UUID, UUID)
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION partner_can_access_vehicle(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION partner_can_access_driver(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION partner_can_access_gps_device(UUID, UUID) FROM PUBLIC;
