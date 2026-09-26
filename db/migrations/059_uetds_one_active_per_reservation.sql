-- One reservation may have at most one active U-ETDS sefer.
-- Cancelled/failed rows stay historical and do not block a later notification.
CREATE UNIQUE INDEX IF NOT EXISTS uetds_notifications_one_active_per_reservation_idx
  ON uetds_notifications (reservation_id)
  WHERE reservation_id IS NOT NULL
    AND status NOT IN ('cancelled', 'failed');
