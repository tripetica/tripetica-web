-- Distinguish a browser speed from a coordinate estimate, and record stream liveness
-- without treating a repeated watch callback as a new measurement.

ALTER TABLE gps_mobile_positions
  ADD COLUMN speed_source TEXT;

ALTER TABLE gps_mobile_positions
  ADD CONSTRAINT gps_mobile_positions_speed_source_chk
  CHECK (speed_source IS NULL OR speed_source IN ('measured', 'estimated'));

ALTER TABLE gps_mobile_sessions
  ADD COLUMN last_stream_at TIMESTAMPTZ;
