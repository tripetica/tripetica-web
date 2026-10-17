-- Vehicle subscriptions are the live source for U-ETDS, GPS-ATS, and Mobil GPS.
-- Driver columns and period rows stay in place as history. This script does not
-- clear them, delete a period, or send an ATS notification.
-- A driver moves only through the unique default vehicle pairing.
-- GPS-ATS starts active only on plate 34EGP847, the live physical ATS vehicle.

ALTER TABLE partner_vehicles
  ADD COLUMN IF NOT EXISTS uetds_subscription_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS uetds_subscription_monthly_fee NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS uetds_subscription_currency TEXT,
  ADD COLUMN IF NOT EXISTS service_standard_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS service_standard_fee NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS service_advanced_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS service_advanced_fee NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS service_gps_ats_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS service_gps_ats_fee NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS service_mobile_gps_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS service_mobile_gps_fee NUMERIC(12, 2);

ALTER TABLE partner_vehicles
  DROP CONSTRAINT IF EXISTS partner_vehicles_uetds_subscription_currency_chk;
ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_uetds_subscription_currency_chk
  CHECK (
    uetds_subscription_currency IS NULL
    OR uetds_subscription_currency IN ('USD', 'TRY', 'EUR')
  );

ALTER TABLE partner_vehicles
  DROP CONSTRAINT IF EXISTS partner_vehicles_service_standard_fee_chk;
ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_service_standard_fee_chk
  CHECK (service_standard_fee IS NULL OR service_standard_fee >= 0);

ALTER TABLE partner_vehicles
  DROP CONSTRAINT IF EXISTS partner_vehicles_service_advanced_fee_chk;
ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_service_advanced_fee_chk
  CHECK (service_advanced_fee IS NULL OR service_advanced_fee >= 0);

ALTER TABLE partner_vehicles
  DROP CONSTRAINT IF EXISTS partner_vehicles_service_gps_ats_fee_chk;
ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_service_gps_ats_fee_chk
  CHECK (service_gps_ats_fee IS NULL OR service_gps_ats_fee >= 0);

ALTER TABLE partner_vehicles
  DROP CONSTRAINT IF EXISTS partner_vehicles_service_mobile_fee_chk;
ALTER TABLE partner_vehicles
  ADD CONSTRAINT partner_vehicles_service_mobile_fee_chk
  CHECK (service_mobile_gps_fee IS NULL OR service_mobile_gps_fee >= 0);

COMMENT ON COLUMN partner_vehicles.service_gps_ats_enabled IS
  'Physical GPS ministry ATS. Does not create a device or a send by itself.';
COMMENT ON COLUMN partner_vehicles.service_mobile_gps_enabled IS
  'Phone location sharing for this vehicle. Independent of GPS-ATS.';

CREATE TABLE IF NOT EXISTS partner_vehicle_uetds_subscription_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status TEXT NOT NULL CHECK (status IN ('unpaid', 'paid', 'free')),
  amount_snapshot NUMERIC(12, 2),
  currency_snapshot TEXT CHECK (
    currency_snapshot IS NULL OR currency_snapshot IN ('USD', 'TRY', 'EUR')
  ),
  marked_at TIMESTAMPTZ,
  marked_by_ops_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_vehicle_uetds_subscription_periods_uidx
    UNIQUE (vehicle_id, period_year, period_month),
  CONSTRAINT partner_vehicle_uetds_subscription_periods_paid_snapshot_chk
    CHECK (
      (status = 'paid' AND amount_snapshot IS NOT NULL AND currency_snapshot IS NOT NULL)
      OR (status <> 'paid' AND amount_snapshot IS NULL AND currency_snapshot IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS partner_vehicle_uetds_subscription_periods_vehicle_idx
  ON partner_vehicle_uetds_subscription_periods (vehicle_id);

CREATE TABLE IF NOT EXISTS partner_vehicle_uetds_subscription_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  reminder_kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_vehicle_uetds_subscription_reminders_uidx
    UNIQUE (vehicle_id, period_year, period_month, reminder_kind)
);

-- Copy once. A later run must not overwrite an ops edit or duplicate a period.
UPDATE partner_vehicles vehicle
   SET uetds_subscription_enrolled_at = driver.uetds_subscription_enrolled_at,
       uetds_subscription_monthly_fee = driver.uetds_subscription_monthly_fee,
       uetds_subscription_currency = driver.uetds_subscription_currency,
       service_standard_enabled = driver.service_standard_enabled,
       service_standard_fee = driver.service_standard_fee,
       service_advanced_enabled = driver.service_advanced_enabled,
       service_advanced_fee = driver.service_advanced_fee,
       service_mobile_gps_enabled = driver.service_mobile_gps_enabled,
       service_mobile_gps_fee = driver.service_mobile_gps_fee
  FROM partner_fleet_defaults pairing
  JOIN partner_drivers driver
    ON driver.id = pairing.driver_id
   AND driver.deleted_at IS NULL
 WHERE vehicle.id = pairing.vehicle_id
   AND vehicle.deleted_at IS NULL
   AND vehicle.uetds_subscription_enrolled_at IS NULL
   AND vehicle.uetds_subscription_monthly_fee IS NULL
   AND vehicle.uetds_subscription_currency IS NULL
   AND vehicle.service_standard_enabled = FALSE
   AND vehicle.service_advanced_enabled = FALSE
   AND vehicle.service_gps_ats_enabled = FALSE
   AND vehicle.service_mobile_gps_enabled = FALSE
   AND vehicle.service_standard_fee IS NULL
   AND vehicle.service_advanced_fee IS NULL
   AND vehicle.service_gps_ats_fee IS NULL
   AND vehicle.service_mobile_gps_fee IS NULL
   AND NOT EXISTS (
     SELECT 1
       FROM partner_fleet_defaults other
      WHERE other.vehicle_id = pairing.vehicle_id
        AND other.driver_id <> pairing.driver_id
   );

INSERT INTO partner_vehicle_uetds_subscription_periods (
  vehicle_id, period_year, period_month, status,
  amount_snapshot, currency_snapshot, marked_at, marked_by_ops_user_id
)
SELECT pairing.vehicle_id,
       period.period_year,
       period.period_month,
       period.status,
       period.amount_snapshot,
       period.currency_snapshot,
       period.marked_at,
       period.marked_by_ops_user_id
  FROM partner_driver_uetds_subscription_periods period
  JOIN partner_fleet_defaults pairing ON pairing.driver_id = period.driver_id
  JOIN partner_vehicles vehicle
    ON vehicle.id = pairing.vehicle_id
   AND vehicle.deleted_at IS NULL
  JOIN partner_drivers driver
    ON driver.id = pairing.driver_id
   AND driver.deleted_at IS NULL
 WHERE NOT EXISTS (
   SELECT 1
     FROM partner_fleet_defaults other
    WHERE other.vehicle_id = pairing.vehicle_id
      AND other.driver_id <> pairing.driver_id
 )
ON CONFLICT (vehicle_id, period_year, period_month) DO NOTHING;

UPDATE partner_vehicles
   SET service_gps_ats_enabled = TRUE,
       service_gps_ats_fee = COALESCE(service_gps_ats_fee, 5.00)
 WHERE deleted_at IS NULL
   AND lower(regexp_replace(plate, '\s+', '', 'g')) = '34egp847'
   AND service_gps_ats_enabled = FALSE;

REVOKE ALL ON TABLE partner_vehicle_uetds_subscription_periods FROM PUBLIC;
REVOKE ALL ON TABLE partner_vehicle_uetds_subscription_reminders FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_vehicle_uetds_subscription_periods TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_vehicle_uetds_subscription_reminders TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_vehicle_uetds_subscription_periods TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_vehicle_uetds_subscription_reminders TO tripetica_app;
  END IF;
END
$$;
