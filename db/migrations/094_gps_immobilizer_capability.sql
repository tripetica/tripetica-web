-- Per-device immobilizer capability. Defaults stay closed.
-- A Teltonika row does not enable the relay, the verification, or the service.
-- Does not send a DOUT command and does not change GPS, ATS, or listener tables.

ALTER TABLE gps_immobilizer_status
  ADD COLUMN hardware_supported BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN relay_installed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN installation_verified_at TIMESTAMPTZ,
  ADD COLUMN installation_verified_by TEXT,
  ADD COLUMN service_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE gps_immobilizer_status
  ADD CONSTRAINT gps_immobilizer_relay_requires_support_chk
    CHECK (NOT relay_installed OR hardware_supported),
  ADD CONSTRAINT gps_immobilizer_verified_requires_relay_chk
    CHECK (installation_verified_at IS NULL OR relay_installed),
  ADD CONSTRAINT gps_immobilizer_verifier_requires_time_chk
    CHECK (
      installation_verified_by IS NULL
      OR (installation_verified_at IS NOT NULL AND char_length(installation_verified_by) BETWEEN 1 AND 120)
    ),
  ADD CONSTRAINT gps_immobilizer_service_requires_verification_chk
    CHECK (NOT service_enabled OR installation_verified_at IS NOT NULL);

COMMENT ON COLUMN gps_immobilizer_status.hardware_supported IS
  'Ops marked this FMB920 or FMC920 as able to drive DOUT1. Receiver type alone does not set it.';
COMMENT ON COLUMN gps_immobilizer_status.relay_installed IS
  'A relay is physically mounted on DOUT1. This is not installation verification.';
COMMENT ON COLUMN gps_immobilizer_status.installation_verified_at IS
  'When an authorized ops user verified the DOUT1 relay installation.';
COMMENT ON COLUMN gps_immobilizer_status.service_enabled IS
  'Partner may see the control. The socket command stays closed until a separate dispatch approval.';
