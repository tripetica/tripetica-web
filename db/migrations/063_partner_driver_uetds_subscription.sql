-- Driver-scoped U-ETDS subscription (fee + monthly period status).
-- Enforcement applies only when uetds_subscription_enrolled_at IS NOT NULL.
-- Legacy drivers remain unenrolled so existing U-ETDS notify is not blocked.

ALTER TABLE partner_drivers
  ADD COLUMN IF NOT EXISTS uetds_subscription_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS uetds_subscription_monthly_fee NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS uetds_subscription_currency TEXT;

ALTER TABLE partner_drivers
  DROP CONSTRAINT IF EXISTS partner_drivers_uetds_subscription_currency_chk;

ALTER TABLE partner_drivers
  ADD CONSTRAINT partner_drivers_uetds_subscription_currency_chk
  CHECK (
    uetds_subscription_currency IS NULL
    OR uetds_subscription_currency IN ('USD', 'TRY', 'EUR')
  );

ALTER TABLE partner_drivers
  DROP CONSTRAINT IF EXISTS partner_drivers_uetds_subscription_fee_chk;

ALTER TABLE partner_drivers
  ADD CONSTRAINT partner_drivers_uetds_subscription_fee_chk
  CHECK (
    uetds_subscription_monthly_fee IS NULL
    OR uetds_subscription_monthly_fee >= 0
  );

COMMENT ON COLUMN partner_drivers.uetds_subscription_enrolled_at IS
  'When set, this driver is managed by U-ETDS subscription enforcement. NULL = legacy unenrolled.';
COMMENT ON COLUMN partner_drivers.uetds_subscription_monthly_fee IS
  'Current monthly subscription fee for future periods. Past paid snapshots are immutable.';
COMMENT ON COLUMN partner_drivers.uetds_subscription_currency IS
  'Current fee currency: USD, TRY, or EUR only.';

CREATE TABLE IF NOT EXISTS partner_driver_uetds_subscription_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES partner_drivers (id) ON DELETE CASCADE,
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
  CONSTRAINT partner_driver_uetds_subscription_periods_uidx
    UNIQUE (driver_id, period_year, period_month),
  CONSTRAINT partner_driver_uetds_subscription_periods_paid_snapshot_chk
    CHECK (
      (status = 'paid' AND amount_snapshot IS NOT NULL AND currency_snapshot IS NOT NULL)
      OR (status <> 'paid' AND amount_snapshot IS NULL AND currency_snapshot IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS partner_driver_uetds_subscription_periods_driver_idx
  ON partner_driver_uetds_subscription_periods (driver_id);

COMMENT ON TABLE partner_driver_uetds_subscription_periods IS
  'Per-driver monthly U-ETDS subscription status. unpaid/paid/free; paid rows keep fee snapshots.';

CREATE TABLE IF NOT EXISTS partner_driver_uetds_subscription_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES partner_drivers (id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  reminder_kind TEXT NOT NULL CHECK (
    reminder_kind IN ('two_days_before', 'last_day', 'expired')
  ),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  CONSTRAINT partner_driver_uetds_subscription_reminders_uidx
    UNIQUE (driver_id, period_year, period_month, reminder_kind)
);

CREATE INDEX IF NOT EXISTS partner_driver_uetds_subscription_reminders_driver_idx
  ON partner_driver_uetds_subscription_reminders (driver_id);

COMMENT ON TABLE partner_driver_uetds_subscription_reminders IS
  'Idempotent claim rows for partner U-ETDS subscription reminder emails.';

REVOKE ALL ON TABLE partner_driver_uetds_subscription_periods FROM PUBLIC;
REVOKE ALL ON TABLE partner_driver_uetds_subscription_reminders FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_driver_uetds_subscription_periods TO tripetica_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_driver_uetds_subscription_reminders TO tripetica_app;
