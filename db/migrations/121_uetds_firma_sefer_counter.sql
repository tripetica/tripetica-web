CREATE TABLE uetds_firma_sefer_counter (
  singleton boolean PRIMARY KEY CHECK (singleton),
  last_millis bigint NOT NULL
);

INSERT INTO uetds_firma_sefer_counter (singleton, last_millis)
SELECT true, COALESCE(MAX(substring(snapshot #>> '{ministry,firmaSeferNo}' FROM '^TRP-([0-9]{13})$')::bigint), 0)
FROM uetds_notifications;
