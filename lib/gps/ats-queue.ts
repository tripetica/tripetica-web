export const ATS_RETRY_SELECT_SQL = `
SELECT submission.id
FROM gps_ats_submissions submission
JOIN gps_devices device
  ON device.id = submission.device_id
 AND device.vehicle_id = submission.vehicle_id
 AND device.status = 'active'
 AND device.live_source = TRUE
WHERE submission.status = 'failed'
  AND submission.ministry_env = 'test'
  AND submission.attempt_count < 3
  AND submission.next_attempt_at IS NOT NULL
  AND submission.next_attempt_at <= $1
  AND NOT EXISTS (
    SELECT 1 FROM gps_ats_settings settings
    WHERE settings.vehicle_id = submission.vehicle_id
      AND settings.enabled = FALSE
  )
`;
