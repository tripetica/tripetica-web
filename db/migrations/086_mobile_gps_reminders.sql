-- DEV reminder log and driver-portal push subscriptions.
-- Does not alter physical GPS, ATS submissions, or partner push tables.

CREATE TABLE gps_mobile_trip_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  notification_id UUID NOT NULL,
  vehicle_id UUID,
  plate TEXT NOT NULL,
  slot_at TIMESTAMPTZ NOT NULL,
  channel TEXT NOT NULL,
  audience TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gps_mobile_trip_reminders_channel_chk CHECK (channel IN ('push', 'email')),
  CONSTRAINT gps_mobile_trip_reminders_audience_chk CHECK (audience IN ('driver', 'owner')),
  CONSTRAINT gps_mobile_trip_reminders_status_chk CHECK (status IN ('planned', 'sent', 'failed', 'skipped')),
  UNIQUE (notification_id, slot_at, channel, audience)
);

CREATE TABLE driver_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES partner_drivers (id) ON DELETE CASCADE,
  partner_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'tr',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX driver_push_subscriptions_endpoint_uidx
  ON driver_push_subscriptions (endpoint);

CREATE INDEX driver_push_subscriptions_active_driver_idx
  ON driver_push_subscriptions (driver_id)
  WHERE disabled_at IS NULL;

REVOKE ALL ON TABLE gps_mobile_trip_reminders FROM PUBLIC;
REVOKE ALL ON TABLE driver_push_subscriptions FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_mobile_trip_reminders TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE driver_push_subscriptions TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gps_mobile_trip_reminders TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE driver_push_subscriptions TO tripetica_app;
  END IF;
END $$;
