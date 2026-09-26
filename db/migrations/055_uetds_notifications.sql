-- Snapshot store for U-ETDS notification submissions.
-- History is reconstructed from snapshot JSON, not live fleet joins.
-- Uploaded documents are never stored.

CREATE TABLE IF NOT EXISTS uetds_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners (id),
  reservation_id UUID REFERENCES reservations (id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'reservation')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('partner', 'ops')),
  actor_user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('recorded')),
  company_id UUID REFERENCES uetds_companies (id) ON DELETE SET NULL,
  company_short_name TEXT NOT NULL,
  driver_id UUID,
  vehicle_id UUID,
  snapshot JSONB NOT NULL,
  ministry_env TEXT NOT NULL DEFAULT 'none' CHECK (ministry_env IN ('none', 'test', 'live')),
  ministry_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uetds_notifications_partner_created_idx
  ON uetds_notifications (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS uetds_notifications_created_idx
  ON uetds_notifications (created_at DESC);

COMMENT ON TABLE uetds_notifications IS
  'Final structured U-ETDS notification snapshots. Document files are not stored.';
