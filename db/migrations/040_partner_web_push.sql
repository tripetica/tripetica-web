-- Partner Portal Web Push subscriptions and per-audience job release events.
-- Additive; does not alter reservation, booking, or ops_push tables.

CREATE TABLE IF NOT EXISTS partner_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  partner_user_id UUID NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'tr',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_push_subscriptions_endpoint_uidx
  ON partner_push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS partner_push_subscriptions_active_user_idx
  ON partner_push_subscriptions (partner_id, partner_user_id)
  WHERE disabled_at IS NULL;

CREATE TABLE IF NOT EXISTS partner_push_events (
  event_type TEXT NOT NULL,
  reservation_id UUID NOT NULL,
  audience_rank SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_type, reservation_id, audience_rank),
  CONSTRAINT partner_push_events_type_chk
    CHECK (event_type IN ('partner_job_released')),
  CONSTRAINT partner_push_events_rank_chk
    CHECK (audience_rank IN (0, 1, 2, 3))
);

REVOKE ALL ON TABLE partner_push_subscriptions FROM PUBLIC;
REVOKE ALL ON TABLE partner_push_events FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_push_subscriptions TO tripetica_app;
GRANT SELECT, INSERT ON TABLE partner_push_events TO tripetica_app;
