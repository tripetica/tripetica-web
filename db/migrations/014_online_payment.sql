-- Online SBP / Turinvoice payment fields on reservations.
-- Cash reservations leave these NULL (except payment_method = cash).

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_payment_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_currency CHAR(3),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_payment_provider_order_id_uidx
  ON reservations (payment_provider_order_id)
  WHERE payment_provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reservations_payment_status_idx
  ON reservations (payment_status)
  WHERE payment_status IS NOT NULL;
