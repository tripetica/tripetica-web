-- Extra partner users keep the same partner account. Owners stay the original logins.
-- Mobile share preference is separate from a live position stream.

ALTER TABLE partner_users
  ADD COLUMN is_owner BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE partner_users SET is_owner = TRUE;

CREATE TABLE partner_user_grants (
  user_id UUID NOT NULL REFERENCES partner_users (id) ON DELETE CASCADE,
  tab TEXT NOT NULL,
  PRIMARY KEY (user_id, tab),
  CONSTRAINT partner_user_grants_tab_chk CHECK (tab IN (
    'jobs',
    'accepted',
    'drivers',
    'vehicles',
    'gps',
    'uetds',
    'edevlet',
    'profile',
    'billing',
    'users'
  ))
);

ALTER TABLE gps_mobile_sessions
  ADD COLUMN client_token TEXT,
  ADD COLUMN share_enabled BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO gps_mobile_events (partner_id, driver_id, vehicle_id, session_id, kind)
SELECT partner_id, driver_id, vehicle_id, id, 'stream_lost'
  FROM gps_mobile_sessions
 WHERE status = 'active'
   AND client_token IS NULL
   AND (last_fix_at IS NULL OR last_fix_at < NOW() - INTERVAL '2 minutes');

UPDATE gps_mobile_sessions
   SET status = 'stopped',
       stopped_at = COALESCE(stopped_at, NOW()),
       stop_reason = 'stream_lost',
       share_enabled = FALSE
 WHERE status = 'active'
   AND client_token IS NULL
   AND (last_fix_at IS NULL OR last_fix_at < NOW() - INTERVAL '2 minutes');

REVOKE ALL ON TABLE partner_user_grants FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_user_grants TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_user_grants TO tripetica_app;
  END IF;
END
$$;
