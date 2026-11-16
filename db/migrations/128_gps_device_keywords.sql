-- Device configuration keywords. The keyword itself is stored only as a sealed value.
-- This migration does not send setkey or delkey.

CREATE TABLE gps_device_keywords (
  device_id UUID PRIMARY KEY REFERENCES gps_devices (id),
  sealed TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gps_device_keyword_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES gps_devices (id),
  action TEXT NOT NULL CHECK (action IN ('set', 'remove')),
  phase TEXT NOT NULL CHECK (phase IN (
    'no_link',
    'preparing',
    'armed',
    'sent',
    'accepted',
    'unverified',
    'failed'
  )),
  error TEXT,
  sealed_command TEXT,
  sealed_next TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX gps_device_keyword_jobs_device_idx ON gps_device_keyword_jobs (device_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON gps_device_keywords, gps_device_keyword_jobs TO tripetica_dev_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON gps_device_keywords, gps_device_keyword_jobs TO tripetica_app;
