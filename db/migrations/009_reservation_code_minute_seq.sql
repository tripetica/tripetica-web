-- Minute-bucket reservation codes: TRP-DDMMYYYY-HHMM-0001 (Europe/Istanbul).

CREATE TABLE IF NOT EXISTS reservation_code_minute_seq (
  minute_key TEXT PRIMARY KEY,
  last_seq INTEGER NOT NULL,
  CONSTRAINT reservation_code_minute_seq_range_chk
    CHECK (last_seq >= 1 AND last_seq <= 9999)
);

REVOKE ALL ON TABLE reservation_code_minute_seq FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reservation_code_minute_seq TO tripetica_app;
