-- Preserve legacy standalone drivers while ensuring a driver that has ever
-- been vehicle-scoped does not reappear for its creator after an unpair/transfer.

ALTER TABLE partner_drivers
  ADD COLUMN vehicle_derived_visibility BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE partner_drivers driver
   SET vehicle_derived_visibility = TRUE
 WHERE EXISTS (
   SELECT 1
     FROM partner_fleet_defaults pairing
    WHERE pairing.driver_id = driver.id
 );

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
         EXISTS (
           SELECT 1
             FROM partner_fleet_defaults pairing
             JOIN partner_vehicle_access access
               ON access.vehicle_id = pairing.vehicle_id
            WHERE pairing.driver_id = driver.id
              AND access.partner_id = requested_partner_id
         )
         OR (
           driver.partner_id = requested_partner_id
           AND driver.vehicle_derived_visibility = FALSE
           AND NOT EXISTS (
             SELECT 1
               FROM partner_fleet_defaults pairing
              WHERE pairing.driver_id = driver.id
           )
         )
       )
  )
$$;
