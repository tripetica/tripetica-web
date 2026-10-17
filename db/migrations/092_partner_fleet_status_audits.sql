-- Explicit partner/ops fleet status changes. Does not alter trip, GPS, or ministry rows.

CREATE TABLE IF NOT EXISTS partner_fleet_status_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_kind TEXT NOT NULL CHECK (record_kind IN ('driver', 'vehicle')),
  record_id UUID NOT NULL,
  partner_id UUID NOT NULL REFERENCES partners (id),
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('partner', 'ops')),
  actor_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_fleet_status_audits_record_idx
  ON partner_fleet_status_audits (record_kind, record_id, created_at DESC);

COMMENT ON TABLE partner_fleet_status_audits IS
  'Who changed a driver or vehicle between active and inactive, with the previous and next status.';

REVOKE ALL ON TABLE partner_fleet_status_audits FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT ON TABLE partner_fleet_status_audits TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT ON TABLE partner_fleet_status_audits TO tripetica_app;
  END IF;
END
$$;
