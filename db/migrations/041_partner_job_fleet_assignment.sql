-- Reservation driver/vehicle assignment snapshots for Partner Portal + Ops.
-- Additive only: does not rewrite claim, payout, fleet modules, or push.

ALTER TABLE reservations
  ADD COLUMN assigned_driver_snapshot JSONB,
  ADD COLUMN assigned_vehicle_snapshot JSONB,
  ADD COLUMN assignment_updated_at TIMESTAMPTZ,
  ADD COLUMN assignment_updated_by_partner_user_id UUID REFERENCES partner_users (id);

ALTER TABLE reservations
  ADD CONSTRAINT reservations_assigned_driver_shape_chk
  CHECK (
    (
      assigned_driver_kind IS NULL
      AND assigned_driver_id IS NULL
    )
    OR (
      assigned_driver_kind = 'registered'
      AND assigned_driver_id IS NOT NULL
    )
    OR (
      assigned_driver_kind = 'non_trp'
      AND assigned_driver_id IS NULL
      AND assigned_driver_snapshot IS NOT NULL
    )
  );

ALTER TABLE reservations
  ADD CONSTRAINT reservations_assigned_vehicle_shape_chk
  CHECK (
    (
      assigned_vehicle_kind IS NULL
      AND assigned_vehicle_id IS NULL
    )
    OR (
      assigned_vehicle_kind = 'registered'
      AND assigned_vehicle_id IS NOT NULL
    )
    OR (
      assigned_vehicle_kind = 'non_trp'
      AND assigned_vehicle_id IS NULL
      AND assigned_vehicle_snapshot IS NOT NULL
    )
  );

CREATE INDEX reservations_assigned_driver_idx
  ON reservations (assigned_driver_id)
  WHERE assigned_driver_id IS NOT NULL
    AND deleted_at IS NULL;

CREATE INDEX reservations_assigned_vehicle_idx
  ON reservations (assigned_vehicle_id)
  WHERE assigned_vehicle_id IS NOT NULL
    AND deleted_at IS NULL;

COMMENT ON COLUMN reservations.assigned_driver_snapshot IS
  'Display fallback for a registered driver, or reservation-only NON TRP driver fields.';

COMMENT ON COLUMN reservations.assigned_vehicle_snapshot IS
  'Display fallback for a registered vehicle, or reservation-only NON TRP vehicle fields.';

COMMENT ON COLUMN reservations.assignment_updated_at IS
  'Last partner driver/vehicle assignment change on this reservation.';
