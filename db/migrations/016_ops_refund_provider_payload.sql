-- Extend ops refund tracking with provider raw payload / error / operator.
-- Does NOT recreate fields from 015_ops_refund.sql.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS refund_provider_response JSONB,
  ADD COLUMN IF NOT EXISTS refund_provider_error TEXT,
  ADD COLUMN IF NOT EXISTS refund_provider_raw_status TEXT,
  ADD COLUMN IF NOT EXISTS refund_requested_by_ops_user_id UUID;

COMMENT ON COLUMN reservations.refund_provider_response IS
  'Raw Turinvoice refund request/order refund payload for audit; not shown in ops UI';
COMMENT ON COLUMN reservations.refund_provider_raw_status IS
  'Provider-reported refund status string when available; Tripetica refund_status is authoritative for ops';

-- TODO(Turinvoice): refund final-status contract must be confirmed with provider.
-- Do not set refund_status=completed from undocumented order.refund[] shapes.
