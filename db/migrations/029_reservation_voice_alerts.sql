-- Best-effort Twilio emergency call tracking. Additive; does not alter
-- reservation business columns or existing rows.

CREATE TABLE IF NOT EXISTS reservation_voice_alerts (
  reservation_id UUID PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  twilio_call_sid TEXT,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS reservation_voice_alerts_started_idx
  ON reservation_voice_alerts (started_at)
  WHERE started_at IS NULL;

REVOKE ALL ON TABLE reservation_voice_alerts FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE reservation_voice_alerts TO tripetica_app;
