-- Result states for a configurator job. No command is inserted by this migration.

ALTER TABLE gps_config_jobs DROP CONSTRAINT gps_config_jobs_phase_check;

ALTER TABLE gps_config_jobs ADD CONSTRAINT gps_config_jobs_phase_check CHECK (phase IN (
  'waiting',
  'waiting_link',
  'reading',
  'applying',
  'replied',
  'verifying',
  'verified',
  'failed',
  'unsupported',
  'no_change',
  'unverified'
));
