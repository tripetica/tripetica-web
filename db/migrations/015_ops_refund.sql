-- Ops Turinvoice refund tracking on reservations.
-- Full refund uses payment_amount / payment_currency snapshot (no FX recompute).

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS refund_provider TEXT,
  ADD COLUMN IF NOT EXISTS refund_provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_provider_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS refund_currency CHAR(3),
  ADD COLUMN IF NOT EXISTS refund_status TEXT,
  ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_admin_override BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN reservations.refund_status IS
  'submitted | completed | failed; NULL means no refund';

-- At most one active (submitted/completed) full refund per paid provider order.
CREATE UNIQUE INDEX IF NOT EXISTS reservations_active_refund_order_uidx
  ON reservations (refund_provider_order_id)
  WHERE refund_provider_order_id IS NOT NULL
    AND refund_status IN ('submitted', 'completed');

CREATE INDEX IF NOT EXISTS reservations_refund_status_idx
  ON reservations (refund_status)
  WHERE refund_status IS NOT NULL;
