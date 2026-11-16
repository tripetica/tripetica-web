-- Latest professional-qualification query for one driver and one U-ETDS company.
-- A failed retry keeps the previous documents and verified_at.
-- Rollback: DROP TABLE driver_qualification_checks;

CREATE TABLE driver_qualification_checks (
  driver_id UUID NOT NULL REFERENCES partner_drivers (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES uetds_companies (id),
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  verified_at TIMESTAMPTZ,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_status TEXT NOT NULL,
  sonuc_kodu INTEGER,
  CONSTRAINT driver_qualification_checks_pk PRIMARY KEY (driver_id, company_id),
  CONSTRAINT driver_qualification_checks_status_chk CHECK (attempt_status IN ('verified', 'unverified')),
  CONSTRAINT driver_qualification_checks_documents_chk CHECK (jsonb_typeof(documents) = 'array')
);

CREATE INDEX driver_qualification_checks_attempted_idx
  ON driver_qualification_checks (attempted_at);

REVOKE ALL ON TABLE driver_qualification_checks FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE driver_qualification_checks TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE driver_qualification_checks TO tripetica_app;
  END IF;
END
$$;
