-- Driver Task: public chauffeur operation link + append-only stage events.
-- Additive only. Does not rewrite reservations or assignment.

CREATE TABLE reservation_driver_tasks (
  reservation_id UUID PRIMARY KEY REFERENCES reservations (id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,
  current_stage TEXT NOT NULL DEFAULT 'planned',
  driver_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservation_driver_tasks_stage_chk
    CHECK (current_stage IN ('planned', 'en_route', 'arrived', 'picked_up', 'completed'))
);

CREATE TABLE reservation_driver_task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations (id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_source TEXT NOT NULL,
  driver_kind TEXT,
  driver_id UUID,
  driver_fingerprint TEXT,
  CONSTRAINT reservation_driver_task_events_stage_chk
    CHECK (stage IN ('en_route', 'arrived', 'picked_up', 'completed')),
  CONSTRAINT reservation_driver_task_events_source_chk
    CHECK (event_source IN ('driver_link', 'ops_manual'))
);

CREATE INDEX reservation_driver_task_events_reservation_idx
  ON reservation_driver_task_events (reservation_id, occurred_at ASC);

CREATE INDEX reservation_driver_tasks_stage_idx
  ON reservation_driver_tasks (current_stage);

COMMENT ON TABLE reservation_driver_tasks IS
  'One public Driver Task capability per reservation. Token is rotated on driver change.';
COMMENT ON TABLE reservation_driver_task_events IS
  'Append-only Driver Task stage history. Never updated or deleted.';

REVOKE ALL ON TABLE reservation_driver_tasks FROM PUBLIC;
REVOKE ALL ON TABLE reservation_driver_task_events FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reservation_driver_tasks TO tripetica_app;
    GRANT SELECT, INSERT ON TABLE reservation_driver_task_events TO tripetica_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reservation_driver_tasks TO tripetica_dev_app;
    GRANT SELECT, INSERT ON TABLE reservation_driver_task_events TO tripetica_dev_app;
  END IF;
END
$$;
