-- Ops Web Push subscriptions and one-shot notification events.
-- Additive; does not alter reservation or reservation_searches business columns.

CREATE TABLE IF NOT EXISTS ops_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ops_user_id UUID NOT NULL REFERENCES ops_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'tr',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ops_push_subscriptions_endpoint_uidx
  ON ops_push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS ops_push_subscriptions_active_user_idx
  ON ops_push_subscriptions (ops_user_id)
  WHERE disabled_at IS NULL;

CREATE TABLE IF NOT EXISTS ops_push_events (
  event_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_type, source_id),
  CONSTRAINT ops_push_events_type_chk
    CHECK (event_type IN ('process_created', 'reservation_confirmed'))
);

REVOKE ALL ON TABLE ops_push_subscriptions FROM PUBLIC;
REVOKE ALL ON TABLE ops_push_events FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ops_push_subscriptions TO tripetica_app;
GRANT SELECT, INSERT ON TABLE ops_push_events TO tripetica_app;
