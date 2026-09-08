-- Canonical reservation ↔ accepted-partner assignment.
-- Additive only: no booking rewrite, no document/fleet assignment UI.

ALTER TABLE reservations
  ADD COLUMN accepted_partner_id UUID REFERENCES partners (id),
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD COLUMN accepted_by_partner_user_id UUID REFERENCES partner_users (id),
  ADD COLUMN assigned_driver_kind TEXT,
  ADD COLUMN assigned_driver_id UUID REFERENCES partner_drivers (id),
  ADD COLUMN assigned_vehicle_kind TEXT,
  ADD COLUMN assigned_vehicle_id UUID REFERENCES partner_vehicles (id);

ALTER TABLE reservations
  ADD CONSTRAINT reservations_assigned_driver_kind_chk
  CHECK (assigned_driver_kind IS NULL OR assigned_driver_kind IN ('registered', 'non_trp'));

ALTER TABLE reservations
  ADD CONSTRAINT reservations_assigned_vehicle_kind_chk
  CHECK (assigned_vehicle_kind IS NULL OR assigned_vehicle_kind IN ('registered', 'non_trp'));

CREATE UNIQUE INDEX reservations_accepted_partner_uidx
  ON reservations (id)
  WHERE accepted_partner_id IS NOT NULL
    AND deleted_at IS NULL;

CREATE INDEX reservations_open_jobs_idx
  ON reservations (pickup_at, created_at)
  WHERE accepted_partner_id IS NULL
    AND deleted_at IS NULL
    AND status = 'confirmed';

CREATE INDEX reservations_accepted_partner_idx
  ON reservations (accepted_partner_id, accepted_at DESC)
  WHERE accepted_partner_id IS NOT NULL
    AND deleted_at IS NULL;

COMMENT ON COLUMN reservations.accepted_partner_id IS
  'Partner that atomically claimed this reservation. Null means the job is still open.';

COMMENT ON COLUMN reservations.assigned_driver_kind IS
  'Future assignment: registered partner_drivers row or external NON TRP driver.';

COMMENT ON COLUMN reservations.assigned_vehicle_kind IS
  'Future assignment: registered partner_vehicles row or external NON TRP vehicle.';
