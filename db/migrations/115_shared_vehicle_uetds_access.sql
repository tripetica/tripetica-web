-- A U-ETDS notification remains one owned Ministry record. Partner panel
-- visibility/management additionally follows the notification vehicle's
-- current equal-access grants; company and Ministry ownership never change.

CREATE OR REPLACE FUNCTION partner_can_access_uetds_notification(
  requested_partner_id UUID,
  requested_notification_id UUID
) RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM uetds_notifications notification
     WHERE notification.id = requested_notification_id
       AND (
         notification.partner_id = requested_partner_id
         OR (
           notification.vehicle_id IS NOT NULL
           AND partner_can_access_vehicle(requested_partner_id, notification.vehicle_id)
         )
       )
  )
$$;

REVOKE EXECUTE ON FUNCTION partner_can_access_uetds_notification(UUID, UUID) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT EXECUTE ON FUNCTION partner_can_access_uetds_notification(UUID, UUID) TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT EXECUTE ON FUNCTION partner_can_access_uetds_notification(UUID, UUID) TO tripetica_app;
  END IF;
END
$$;
