-- Allow the first successful mobile fix to be recorded as its own event.

ALTER TABLE gps_mobile_events DROP CONSTRAINT gps_mobile_events_kind_check;

ALTER TABLE gps_mobile_events ADD CONSTRAINT gps_mobile_events_kind_check
  CHECK (kind IN (
    'started',
    'first_fix',
    'stopped',
    'permission_denied',
    'stream_lost',
    'stream_resumed',
    'subscription_closed',
    'vehicle_changed',
    'access_revoked'
  ));
