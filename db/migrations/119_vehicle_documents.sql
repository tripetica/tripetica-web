-- Current vehicle documents. One row per vehicle and document type.
-- Renewal updates that row. This migration does not create a document history table.
-- Reminder claims keep expires_on so a new expiry starts a new schedule and the old one stops.
-- Rollback: DROP TABLE vehicle_document_reminders; DROP TABLE vehicle_documents;

CREATE TABLE vehicle_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES partner_vehicles (id),
  document_type TEXT NOT NULL,
  expires_on DATE NOT NULL,
  policy_number TEXT,
  file_path TEXT,
  file_mime TEXT,
  file_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  actor_kind TEXT,
  CONSTRAINT vehicle_documents_vehicle_type_uidx UNIQUE (vehicle_id, document_type),
  CONSTRAINT vehicle_documents_type_chk CHECK (
    document_type IN (
      'ibb_route_permit',
      'inspection',
      'traffic_insurance',
      'casco',
      'seat_accident'
    )
  ),
  CONSTRAINT vehicle_documents_date_chk CHECK (
    expires_on >= DATE '2000-01-01' AND expires_on <= DATE '2100-12-31'
  ),
  CONSTRAINT vehicle_documents_policy_chk CHECK (
    policy_number IS NULL OR char_length(policy_number) <= 80
  ),
  CONSTRAINT vehicle_documents_actor_chk CHECK (
    actor_kind IS NULL OR actor_kind IN ('ops', 'partner')
  ),
  CONSTRAINT vehicle_documents_file_chk CHECK (
    (
      file_path IS NULL
      AND file_mime IS NULL
      AND file_name IS NULL
    )
    OR (
      file_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|heic)$'
      AND file_mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/heic')
      AND file_name IS NOT NULL
      AND char_length(file_name) <= 80
    )
  )
);

CREATE INDEX vehicle_documents_vehicle_idx
  ON vehicle_documents (vehicle_id);

CREATE INDEX vehicle_documents_file_path_idx
  ON vehicle_documents (file_path)
  WHERE file_path IS NOT NULL;

CREATE TABLE vehicle_document_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vehicle_documents (id) ON DELETE CASCADE,
  expires_on DATE NOT NULL,
  notify_on DATE NOT NULL,
  clock TEXT NOT NULL,
  channel TEXT NOT NULL,
  partner_user_id UUID NOT NULL REFERENCES partner_users (id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_document_reminders_uidx UNIQUE (
    document_id, expires_on, notify_on, clock, channel, partner_user_id
  ),
  CONSTRAINT vehicle_document_reminders_clock_chk CHECK (clock IN ('10:00', '14:00')),
  CONSTRAINT vehicle_document_reminders_channel_chk CHECK (channel IN ('email', 'push')),
  CONSTRAINT vehicle_document_reminders_status_chk CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE INDEX vehicle_document_reminders_slot_idx
  ON vehicle_document_reminders (notify_on, clock, status);

REVOKE ALL ON TABLE vehicle_documents FROM PUBLIC;
REVOKE ALL ON TABLE vehicle_document_reminders FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle_documents TO tripetica_dev_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle_document_reminders TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle_documents TO tripetica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle_document_reminders TO tripetica_app;
  END IF;
END
$$;
