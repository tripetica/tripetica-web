-- Three service subscriptions replace Standard/Gold as the active decision.
-- membership_status stays as history. Paid period snapshots are not rewritten.
-- Unenrolled drivers keep notification access through the standard service flag
-- without a new fee or a new period row.

ALTER TABLE partner_drivers
  ADD COLUMN service_standard_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN service_standard_fee NUMERIC(12, 2),
  ADD COLUMN service_advanced_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN service_advanced_fee NUMERIC(12, 2),
  ADD COLUMN service_mobile_gps_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN service_mobile_gps_fee NUMERIC(12, 2);

ALTER TABLE partner_drivers
  ADD CONSTRAINT partner_drivers_service_standard_fee_chk
  CHECK (service_standard_fee IS NULL OR service_standard_fee >= 0),
  ADD CONSTRAINT partner_drivers_service_advanced_fee_chk
  CHECK (service_advanced_fee IS NULL OR service_advanced_fee >= 0),
  ADD CONSTRAINT partner_drivers_service_mobile_fee_chk
  CHECK (service_mobile_gps_fee IS NULL OR service_mobile_gps_fee >= 0);

UPDATE partner_drivers
SET service_standard_enabled = TRUE,
    service_standard_fee = CASE
      WHEN uetds_subscription_enrolled_at IS NOT NULL THEN uetds_subscription_monthly_fee
      ELSE NULL
    END,
    service_advanced_enabled = (membership_status = 'gold'),
    service_advanced_fee = CASE
      WHEN membership_status = 'gold' AND uetds_subscription_enrolled_at IS NOT NULL THEN 0
      ELSE NULL
    END;

COMMENT ON COLUMN partner_drivers.service_standard_enabled IS
  'U-ETDS standard notification. Replaces the Standard membership decision.';
COMMENT ON COLUMN partner_drivers.service_advanced_enabled IS
  'U-ETDS advanced notification and Kamu Uygulama Merkezi edit. Replaces Gold.';
COMMENT ON COLUMN partner_drivers.service_mobile_gps_enabled IS
  'Phone location sharing. Not a physical tracker subscription.';

CREATE TABLE gps_mobile_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners (id),
  driver_id UUID NOT NULL REFERENCES partner_drivers (id),
  vehicle_id UUID REFERENCES partner_vehicles (id),
  surface TEXT NOT NULL CHECK (surface IN ('partner', 'driver')),
  status TEXT NOT NULL CHECK (status IN ('active', 'stopped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ,
  last_fix_at TIMESTAMPTZ,
  last_accuracy_m NUMERIC,
  stop_reason TEXT
);

CREATE UNIQUE INDEX gps_mobile_one_active_session_idx
  ON gps_mobile_sessions (driver_id)
  WHERE status = 'active';

CREATE TABLE gps_mobile_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES gps_mobile_sessions (id),
  partner_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  vehicle_id UUID,
  recorded_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_m NUMERIC,
  speed_mps NUMERIC,
  heading_deg NUMERIC
);

CREATE INDEX gps_mobile_positions_driver_time_idx
  ON gps_mobile_positions (driver_id, recorded_at DESC);

CREATE TABLE gps_mobile_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  vehicle_id UUID,
  session_id UUID,
  kind TEXT NOT NULL CHECK (kind IN (
    'started',
    'stopped',
    'permission_denied',
    'stream_lost',
    'stream_resumed',
    'subscription_closed',
    'vehicle_changed',
    'access_revoked'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX gps_mobile_events_driver_time_idx
  ON gps_mobile_events (driver_id, created_at DESC);

REVOKE ALL ON TABLE gps_mobile_sessions FROM PUBLIC;
REVOKE ALL ON TABLE gps_mobile_positions FROM PUBLIC;
REVOKE ALL ON TABLE gps_mobile_events FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_mobile_sessions TO tripetica_dev_app;
    GRANT SELECT, INSERT ON TABLE gps_mobile_positions TO tripetica_dev_app;
    GRANT SELECT, INSERT ON TABLE gps_mobile_events TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE gps_mobile_sessions TO tripetica_app;
    GRANT SELECT, INSERT ON TABLE gps_mobile_positions TO tripetica_app;
    GRANT SELECT, INSERT ON TABLE gps_mobile_events TO tripetica_app;
  END IF;
END
$$;
