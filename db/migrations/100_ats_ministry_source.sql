-- Ministry ATS source is chosen per vehicle. Subscriptions keep collecting
-- both GPS feeds. Existing senders are copied from the current dispatch rule:
-- a live device with GPS-ATS stays physical; Mobil GPS without a live device
-- stays mobile. Everyone else stays none. A later run does not overwrite a choice.

ALTER TABLE partner_vehicles
  ADD COLUMN IF NOT EXISTS ats_ministry_source TEXT;

UPDATE partner_vehicles vehicle
   SET ats_ministry_source = 'physical'
 WHERE vehicle.ats_ministry_source IS NULL
   AND vehicle.deleted_at IS NULL
   AND vehicle.service_gps_ats_enabled
   AND EXISTS (
     SELECT 1
       FROM gps_devices device
      WHERE device.vehicle_id = vehicle.id
        AND device.status = 'active'
        AND device.live_source = TRUE
   )
   AND NOT EXISTS (
     SELECT 1
       FROM gps_ats_settings settings
      WHERE settings.vehicle_id = vehicle.id
        AND settings.enabled = FALSE
   );

UPDATE partner_vehicles vehicle
   SET ats_ministry_source = 'mobile'
 WHERE vehicle.ats_ministry_source IS NULL
   AND vehicle.deleted_at IS NULL
   AND vehicle.service_mobile_gps_enabled
   AND NOT EXISTS (
     SELECT 1
       FROM gps_devices device
      WHERE device.vehicle_id = vehicle.id
        AND device.status = 'active'
        AND device.live_source = TRUE
   );

UPDATE partner_vehicles
   SET ats_ministry_source = 'none'
 WHERE ats_ministry_source IS NULL;

ALTER TABLE partner_vehicles
  ALTER COLUMN ats_ministry_source SET DEFAULT 'none';

ALTER TABLE partner_vehicles
  ALTER COLUMN ats_ministry_source SET NOT NULL;

ALTER TABLE partner_vehicles
  DROP CONSTRAINT IF EXISTS partner_vehicles_ats_ministry_source_chk;
ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_ats_ministry_source_chk
  CHECK (ats_ministry_source IN ('physical', 'mobile', 'none'));

COMMENT ON COLUMN partner_vehicles.ats_ministry_source IS
  'Which stored GPS feed is sent to the ministry. none sends nothing and does not stop collection.';

ALTER TABLE ops_record_audits DROP CONSTRAINT IF EXISTS ops_record_audits_record_kind_check;
ALTER TABLE ops_record_audits
  ADD CONSTRAINT ops_record_audits_record_kind_check
  CHECK (record_kind IN ('process', 'reservation', 'vehicle'));
