-- Teltonika DIN1 reading and starter-circuit proof.
-- Does not enable a relay and does not send a DOUT command.
-- ESP32 and mobile GPS columns are not rewritten.

ALTER TABLE gps_device_status
  ADD COLUMN din1_state TEXT;

ALTER TABLE gps_device_status
  ADD CONSTRAINT gps_device_status_din1_chk
    CHECK (din1_state IS NULL OR din1_state IN ('on', 'off'));

COMMENT ON COLUMN gps_device_status.din1_state IS
  'Teltonika AVL ID 1, the DIN1 wire. Not the constant power feed and not ignition IO 239.';

ALTER TABLE gps_immobilizer_status
  ADD COLUMN starter_circuit_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN starter_circuit_verified_at TIMESTAMPTZ,
  ADD COLUMN starter_circuit_verified_by TEXT;

ALTER TABLE gps_immobilizer_status
  ADD CONSTRAINT gps_immobilizer_starter_requires_service_chk
    CHECK (NOT starter_circuit_verified OR service_enabled),
  ADD CONSTRAINT gps_immobilizer_starter_verifier_chk
    CHECK (
      starter_circuit_verified_by IS NULL
      OR (
        starter_circuit_verified
        AND starter_circuit_verified_at IS NOT NULL
        AND char_length(starter_circuit_verified_by) BETWEEN 1 AND 120
      )
    );

COMMENT ON COLUMN gps_immobilizer_status.starter_circuit_verified IS
  'Ops recorded that the relay interrupts only the starter circuit and does not stop a running engine. Until this is true, the digital output is not written to the socket.';
