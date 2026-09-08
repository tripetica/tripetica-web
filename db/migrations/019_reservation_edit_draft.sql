-- Stage 2: link an active booking draft to an original reservation being edited.
-- Financial snapshot columns are read-only references for Stage 3 price-diff / money movement.
-- Original reservations rows are never mutated by creating or abandoning an edit draft.

ALTER TABLE reservation_searches
  ADD COLUMN IF NOT EXISTS editing_reservation_id UUID
    REFERENCES reservations (id)
    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edit_original_reservation_code TEXT,
  ADD COLUMN IF NOT EXISTS edit_original_total_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS edit_original_currency CHAR(3),
  ADD COLUMN IF NOT EXISTS edit_original_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS edit_original_payment_status TEXT,
  ADD COLUMN IF NOT EXISTS edit_original_payment_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS edit_original_payment_currency CHAR(3),
  ADD COLUMN IF NOT EXISTS edit_original_payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS edit_original_payment_provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS edit_original_fx_snapshot JSONB;

CREATE INDEX IF NOT EXISTS reservation_searches_editing_reservation_id_idx
  ON reservation_searches (editing_reservation_id)
  WHERE editing_reservation_id IS NOT NULL;

-- At most one active edit draft per original reservation (any browser session).
CREATE UNIQUE INDEX IF NOT EXISTS reservation_searches_one_active_edit_per_reservation_uidx
  ON reservation_searches (editing_reservation_id)
  WHERE status = 'draft' AND editing_reservation_id IS NOT NULL;
