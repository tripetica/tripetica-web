-- Suspicion alerts that were raised for vehicles without an active physical
-- GPS-ATS subscription are marked, not deleted. Ministry fault rows stay untouched.

ALTER TABLE gps_ats_alert_deliveries
  ADD COLUMN IF NOT EXISTS false_alarm BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN gps_ats_alert_deliveries.false_alarm IS
  'True when a suspicion alert was raised for a vehicle that does not have an active physical GPS-ATS subscription. The row stays for audit.';

ALTER TABLE gps_ats_outages DROP CONSTRAINT IF EXISTS gps_ats_outages_close_chk;
ALTER TABLE gps_ats_outages
  ADD CONSTRAINT gps_ats_outages_close_chk
  CHECK (close_reason IS NULL OR close_reason IN (
    'gnss_restored', 'fault_reported', 'trip_ended', 'ats_recovered', 'subscription_excluded'
  ));

UPDATE gps_ats_alert_deliveries delivery
   SET false_alarm = TRUE
 WHERE delivery.kind = 'gnss_outage'
   AND delivery.false_alarm = FALSE
   AND delivery.source_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:'
   AND NOT EXISTS (
     SELECT 1
       FROM partner_vehicles vehicle
      WHERE vehicle.id = split_part(delivery.source_key, ':', 1)::uuid
        AND vehicle.deleted_at IS NULL
        AND vehicle.service_gps_ats_enabled
        AND vehicle.ats_ministry_source = 'physical'
   );

UPDATE gps_ats_outages outage
   SET closed_at = NOW(),
       close_reason = 'subscription_excluded',
       updated_at = NOW()
  FROM partner_vehicles vehicle
 WHERE outage.vehicle_id = vehicle.id
   AND outage.kind = 'gnss'
   AND outage.closed_at IS NULL
   AND NOT (
     vehicle.service_gps_ats_enabled
     AND vehicle.ats_ministry_source = 'physical'
   );
