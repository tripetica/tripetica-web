-- Durable reservation-completion throttling. Email values are stored only as
-- one-way hashes so this abuse-control table does not duplicate customer PII.

CREATE TABLE IF NOT EXISTS reservation_completion_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  browser_session_id UUID NOT NULL,
  reservation_search_id UUID REFERENCES reservation_searches(id) ON DELETE SET NULL,
  email_hash TEXT NOT NULL,
  ip TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reservation_completion_attempts_session_time_idx
  ON reservation_completion_attempts (browser_session_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS reservation_completion_attempts_email_time_idx
  ON reservation_completion_attempts (email_hash, attempted_at DESC);

CREATE INDEX IF NOT EXISTS reservation_completion_attempts_ip_time_idx
  ON reservation_completion_attempts (ip, attempted_at DESC)
  WHERE ip IS NOT NULL;

CREATE INDEX IF NOT EXISTS reservation_completion_attempts_time_idx
  ON reservation_completion_attempts (attempted_at);

REVOKE ALL ON TABLE reservation_completion_attempts FROM PUBLIC;

GRANT SELECT, INSERT, DELETE ON TABLE reservation_completion_attempts TO tripetica_app;
