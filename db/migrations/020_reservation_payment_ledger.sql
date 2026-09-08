-- Stage 3: multi-payment ledger + refund allocations for online/QR reservations.
-- Cash reservations do not use these tables for edit settlement.
-- reservations.* payment/refund columns remain denormalized summaries for compatibility.

CREATE TABLE IF NOT EXISTS reservation_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL
    REFERENCES reservations (id)
    ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  internal_reference TEXT NOT NULL,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'turinvoice',
  provider_order_id TEXT,
  provider_payment_url TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  edit_draft_id UUID
    REFERENCES reservation_searches (id)
    ON DELETE SET NULL,
  edit_settlement_id UUID,
  provider_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  CONSTRAINT reservation_payment_transactions_sequence_chk
    CHECK (sequence_no > 0),
  CONSTRAINT reservation_payment_transactions_amount_chk
    CHECK (amount > 0),
  CONSTRAINT reservation_payment_transactions_kind_chk
    CHECK (kind IN ('initial_payment', 'additional_payment')),
  CONSTRAINT reservation_payment_transactions_status_chk
    CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
  CONSTRAINT reservation_payment_transactions_reservation_sequence_key
    UNIQUE (reservation_id, sequence_no),
  CONSTRAINT reservation_payment_transactions_internal_reference_key
    UNIQUE (internal_reference),
  CONSTRAINT reservation_payment_transactions_idempotency_key
    UNIQUE (idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS reservation_payment_transactions_provider_order_uidx
  ON reservation_payment_transactions (provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reservation_payment_transactions_reservation_idx
  ON reservation_payment_transactions (reservation_id, sequence_no);

CREATE TABLE IF NOT EXISTS reservation_refund_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL
    REFERENCES reservations (id)
    ON DELETE CASCADE,
  kind TEXT NOT NULL,
  required_amount NUMERIC(12, 2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  edit_draft_id UUID
    REFERENCES reservation_searches (id)
    ON DELETE SET NULL,
  edit_settlement_id UUID,
  reason TEXT,
  admin_override BOOLEAN NOT NULL DEFAULT FALSE,
  requested_by_ops_user_id UUID,
  requested_by_customer_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT reservation_refund_batches_amount_chk
    CHECK (required_amount > 0),
  CONSTRAINT reservation_refund_batches_kind_chk
    CHECK (kind IN ('edit_settlement', 'cancel_full', 'ops_manual')),
  CONSTRAINT reservation_refund_batches_status_chk
    CHECK (status IN ('planned', 'submitted', 'partial', 'failed', 'completed')),
  CONSTRAINT reservation_refund_batches_idempotency_key
    UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS reservation_refund_batches_reservation_idx
  ON reservation_refund_batches (reservation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reservation_refund_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL
    REFERENCES reservation_refund_batches (id)
    ON DELETE CASCADE,
  reservation_id UUID NOT NULL
    REFERENCES reservations (id)
    ON DELETE CASCADE,
  payment_transaction_id UUID NOT NULL
    REFERENCES reservation_payment_transactions (id)
    ON DELETE RESTRICT,
  sequence_no INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'turinvoice',
  provider_order_id TEXT NOT NULL,
  provider_refund_id TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  provider_response JSONB,
  provider_error TEXT,
  provider_raw_status TEXT,
  requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservation_refund_allocations_amount_chk
    CHECK (amount > 0),
  CONSTRAINT reservation_refund_allocations_sequence_chk
    CHECK (sequence_no > 0),
  CONSTRAINT reservation_refund_allocations_status_chk
    CHECK (status IN ('planned', 'submitted', 'completed', 'failed')),
  CONSTRAINT reservation_refund_allocations_idempotency_key
    UNIQUE (idempotency_key),
  CONSTRAINT reservation_refund_allocations_batch_sequence_key
    UNIQUE (batch_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS reservation_refund_allocations_payment_idx
  ON reservation_refund_allocations (payment_transaction_id, status);

CREATE INDEX IF NOT EXISTS reservation_refund_allocations_reservation_idx
  ON reservation_refund_allocations (reservation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reservation_edit_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL
    REFERENCES reservations (id)
    ON DELETE CASCADE,
  edit_draft_id UUID NOT NULL
    REFERENCES reservation_searches (id)
    ON DELETE RESTRICT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  old_total NUMERIC(12, 2),
  old_currency CHAR(3),
  new_total NUMERIC(12, 2),
  new_currency CHAR(3),
  difference NUMERIC(12, 2),
  net_collected_before NUMERIC(12, 2),
  payment_transaction_id UUID
    REFERENCES reservation_payment_transactions (id)
    ON DELETE SET NULL,
  refund_batch_id UUID
    REFERENCES reservation_refund_batches (id)
    ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at TIMESTAMPTZ,
  CONSTRAINT reservation_edit_settlements_mode_chk
    CHECK (mode IN ('cash_update', 'zero_diff', 'additional_payment', 'refund')),
  CONSTRAINT reservation_edit_settlements_status_chk
    CHECK (status IN ('pending_payment', 'committed', 'failed')),
  CONSTRAINT reservation_edit_settlements_idempotency_key
    UNIQUE (idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS reservation_edit_settlements_one_pending_per_draft_uidx
  ON reservation_edit_settlements (edit_draft_id)
  WHERE status = 'pending_payment';

CREATE INDEX IF NOT EXISTS reservation_edit_settlements_reservation_idx
  ON reservation_edit_settlements (reservation_id, created_at DESC);

ALTER TABLE reservation_payment_transactions
  ADD CONSTRAINT reservation_payment_transactions_edit_settlement_fkey
  FOREIGN KEY (edit_settlement_id)
  REFERENCES reservation_edit_settlements (id)
  ON DELETE SET NULL;

ALTER TABLE reservation_refund_batches
  ADD CONSTRAINT reservation_refund_batches_edit_settlement_fkey
  FOREIGN KEY (edit_settlement_id)
  REFERENCES reservation_edit_settlements (id)
  ON DELETE SET NULL;

-- Allow multiple partial refunds against the same provider order on reservations summary.
DROP INDEX IF EXISTS reservations_active_refund_order_uidx;

-- Backfill P1 from existing online reservations that already have an order id.
INSERT INTO reservation_payment_transactions (
  reservation_id,
  sequence_no,
  internal_reference,
  kind,
  provider,
  provider_order_id,
  provider_payment_url,
  amount,
  currency,
  status,
  idempotency_key,
  paid_at,
  created_at
)
SELECT
  r.id,
  1,
  r.reservation_code || '-P1',
  'initial_payment',
  COALESCE(NULLIF(r.payment_provider, ''), 'turinvoice'),
  r.payment_provider_order_id,
  r.payment_provider_payment_url,
  COALESCE(r.payment_amount, r.total_price),
  COALESCE(r.payment_currency, r.currency),
  CASE
    WHEN lower(COALESCE(r.payment_status, '')) = 'paid' THEN 'paid'
    ELSE 'pending'
  END,
  'backfill:initial:' || r.id::text,
  r.paid_at,
  COALESCE(r.confirmed_at, r.created_at, NOW())
FROM reservations r
WHERE r.deleted_at IS NULL
  AND lower(COALESCE(r.payment_method, '')) = 'sbp'
  AND r.payment_provider_order_id IS NOT NULL
  AND COALESCE(r.payment_amount, r.total_price) IS NOT NULL
  AND COALESCE(r.payment_currency, r.currency) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM reservation_payment_transactions t
    WHERE t.reservation_id = r.id
  );

-- Backfill a single refund allocation when reservation has an active/submitted refund summary.
INSERT INTO reservation_refund_batches (
  reservation_id,
  kind,
  required_amount,
  currency,
  status,
  idempotency_key,
  reason,
  admin_override,
  requested_by_ops_user_id,
  created_at,
  submitted_at,
  completed_at
)
SELECT
  r.id,
  'ops_manual',
  r.refund_amount,
  r.refund_currency,
  CASE
    WHEN lower(COALESCE(r.refund_status, '')) = 'completed' THEN 'completed'
    WHEN lower(COALESCE(r.refund_status, '')) = 'failed' THEN 'failed'
    ELSE 'submitted'
  END,
  'backfill:refund-batch:' || r.id::text,
  r.refund_reason,
  COALESCE(r.refund_admin_override, FALSE),
  r.refund_requested_by_ops_user_id,
  COALESCE(r.refund_requested_at, NOW()),
  r.refund_requested_at,
  r.refund_completed_at
FROM reservations r
WHERE r.deleted_at IS NULL
  AND r.refund_amount IS NOT NULL
  AND r.refund_currency IS NOT NULL
  AND r.refund_status IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM reservation_refund_batches b WHERE b.reservation_id = r.id
  );

INSERT INTO reservation_refund_allocations (
  batch_id,
  reservation_id,
  payment_transaction_id,
  sequence_no,
  provider,
  provider_order_id,
  provider_refund_id,
  amount,
  currency,
  status,
  idempotency_key,
  provider_response,
  provider_error,
  provider_raw_status,
  requested_at,
  completed_at
)
SELECT
  b.id,
  r.id,
  t.id,
  1,
  COALESCE(NULLIF(r.refund_provider, ''), 'turinvoice'),
  COALESCE(r.refund_provider_order_id, t.provider_order_id),
  r.refund_provider_refund_id,
  r.refund_amount,
  r.refund_currency,
  CASE
    WHEN lower(COALESCE(r.refund_status, '')) = 'completed' THEN 'completed'
    WHEN lower(COALESCE(r.refund_status, '')) = 'failed' THEN 'failed'
    ELSE 'submitted'
  END,
  'backfill:refund-alloc:' || r.id::text,
  r.refund_provider_response,
  r.refund_provider_error,
  r.refund_provider_raw_status,
  r.refund_requested_at,
  r.refund_completed_at
FROM reservations r
INNER JOIN reservation_refund_batches b
  ON b.reservation_id = r.id
 AND b.idempotency_key = 'backfill:refund-batch:' || r.id::text
INNER JOIN reservation_payment_transactions t
  ON t.reservation_id = r.id
 AND t.sequence_no = 1
WHERE r.deleted_at IS NULL
  AND r.refund_amount IS NOT NULL
  AND r.refund_currency IS NOT NULL
  AND r.refund_status IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM reservation_refund_allocations a WHERE a.reservation_id = r.id
  );

REVOKE ALL ON TABLE
  reservation_payment_transactions,
  reservation_refund_batches,
  reservation_refund_allocations,
  reservation_edit_settlements
FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  reservation_payment_transactions,
  reservation_refund_batches,
  reservation_refund_allocations,
  reservation_edit_settlements
TO tripetica_app;
