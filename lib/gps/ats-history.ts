import "server-only";

import { atsHistoryError, atsHistoryLocation } from "@/lib/gps/ats-history-view";
import { getPool } from "@/lib/db/postgres";

export const ATS_HISTORY_PAGE_SIZE = 20;

export type GpsAtsHistoryRow = {
  id: string;
  sentAt: string | null;
  gnssTime: string;
  place: string | null;
  coordinates: string | null;
  status: "succeeded" | "failed" | "pending" | "blocked";
  error: string | null;
};

export type GpsAtsHistory = {
  succeeded: number;
  failed: number;
  page: number;
  hasMore: boolean;
  rows: GpsAtsHistoryRow[];
};

export async function loadGpsAtsNotificationHistory(
  notificationId: string,
  page: number,
): Promise<GpsAtsHistory> {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const offset = (safePage - 1) * ATS_HISTORY_PAGE_SIZE;
  const pool = getPool();
  const counts = await pool.query<{ succeeded: number; failed: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
     FROM (
       SELECT submission.status
         FROM gps_ats_submission_notifications link
         JOIN gps_ats_submissions submission ON submission.id = link.submission_id
        WHERE link.notification_id = $1
       UNION ALL
       SELECT submission.status
         FROM gps_mobile_ats_submission_notifications link
         JOIN gps_mobile_ats_submissions submission ON submission.id = link.submission_id
        WHERE link.notification_id = $1
       UNION ALL
       SELECT status
         FROM gps_mobile_ats_submissions submission
        WHERE notification_id = $1
          AND NOT EXISTS (
            SELECT 1
              FROM gps_mobile_ats_submission_notifications link
             WHERE link.submission_id = submission.id
               AND link.notification_id = $1
          )
     ) attempts`,
    [notificationId],
  );
  const rows = await pool.query<{
    id: string;
    submitted_at: Date | null;
    queued_at: Date;
    gnss_time: Date;
    status: string;
    sonuc_kodu: number | null;
    sonuc_mesaji: string | null;
    last_error: string | null;
    sent_latitude: string | null;
    sent_longitude: string | null;
    sent_il_kodu: number | null;
    sent_ilce_mernis_kodu: number | null;
    position_latitude: string | null;
    position_longitude: string | null;
  }>(
    `SELECT id, submitted_at, queued_at, gnss_time, status, sonuc_kodu, sonuc_mesaji, last_error,
            sent_latitude, sent_longitude, sent_il_kodu, sent_ilce_mernis_kodu,
            position_latitude, position_longitude
     FROM (
       SELECT submission.id,
              submission.submitted_at,
              submission.queued_at,
              submission.gnss_time,
              submission.status,
              submission.sonuc_kodu,
              submission.sonuc_mesaji,
              submission.last_error,
              submission.sent_latitude,
              submission.sent_longitude,
              submission.sent_il_kodu,
              submission.sent_ilce_mernis_kodu,
              position.latitude::text AS position_latitude,
              position.longitude::text AS position_longitude
         FROM gps_ats_submission_notifications link
         JOIN gps_ats_submissions submission ON submission.id = link.submission_id
         LEFT JOIN gps_positions position ON position.id = submission.position_id
        WHERE link.notification_id = $1
       UNION ALL
       SELECT submission.id,
              submission.submitted_at,
              submission.queued_at,
              submission.gnss_time,
              submission.status,
              submission.sonuc_kodu,
              submission.sonuc_mesaji,
              submission.last_error,
              submission.sent_latitude,
              submission.sent_longitude,
              submission.sent_il_kodu,
              submission.sent_ilce_mernis_kodu,
              position.latitude::text AS position_latitude,
              position.longitude::text AS position_longitude
         FROM gps_mobile_ats_submission_notifications link
         JOIN gps_mobile_ats_submissions submission ON submission.id = link.submission_id
         LEFT JOIN gps_mobile_positions position ON position.id = submission.mobile_position_id
        WHERE link.notification_id = $1
       UNION ALL
       SELECT submission.id,
              submission.submitted_at,
              submission.queued_at,
              submission.gnss_time,
              submission.status,
              submission.sonuc_kodu,
              submission.sonuc_mesaji,
              submission.last_error,
              submission.sent_latitude,
              submission.sent_longitude,
              submission.sent_il_kodu,
              submission.sent_ilce_mernis_kodu,
              position.latitude::text AS position_latitude,
              position.longitude::text AS position_longitude
         FROM gps_mobile_ats_submissions submission
         LEFT JOIN gps_mobile_positions position ON position.id = submission.mobile_position_id
        WHERE submission.notification_id = $1
          AND NOT EXISTS (
            SELECT 1
              FROM gps_mobile_ats_submission_notifications link
             WHERE link.submission_id = submission.id
               AND link.notification_id = $1
          )
     ) attempts
     ORDER BY queued_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [notificationId, ATS_HISTORY_PAGE_SIZE + 1, offset],
  );
  const pageRows = rows.rows.slice(0, ATS_HISTORY_PAGE_SIZE);
  return {
    succeeded: counts.rows[0]?.succeeded ?? 0,
    failed: counts.rows[0]?.failed ?? 0,
    page: safePage,
    hasMore: rows.rows.length > ATS_HISTORY_PAGE_SIZE,
    rows: pageRows.map((row) => {
      const status = row.status === "succeeded" || row.status === "failed" || row.status === "blocked"
        ? row.status
        : "pending";
      const error = atsHistoryError(status, row.last_error, row.sonuc_mesaji);
      const location = atsHistoryLocation({
        status,
        sonucKodu: row.sonuc_kodu,
        error,
        sentLatitude: row.sent_latitude,
        sentLongitude: row.sent_longitude,
        sentIlKodu: row.sent_il_kodu,
        sentIlceMernisKodu: row.sent_ilce_mernis_kodu,
        positionLatitude: row.position_latitude,
        positionLongitude: row.position_longitude,
      });
      return {
        id: row.id,
        sentAt: (row.submitted_at ?? row.queued_at).toISOString(),
        gnssTime: row.gnss_time.toISOString(),
        place: location.place,
        coordinates: location.coordinates,
        status,
        error,
      };
    }),
  };
}
