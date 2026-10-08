import "server-only";

import { getPool } from "@/lib/db/postgres";

export const ATS_HISTORY_PAGE_SIZE = 20;

export type GpsAtsHistoryRow = {
  id: string;
  sentAt: string | null;
  gnssTime: string;
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
       COUNT(*) FILTER (WHERE submission.status = 'succeeded')::int AS succeeded,
       COUNT(*) FILTER (WHERE submission.status = 'failed')::int AS failed
     FROM gps_ats_submission_notifications link
     JOIN gps_ats_submissions submission ON submission.id = link.submission_id
     WHERE link.notification_id = $1`,
    [notificationId],
  );
  const rows = await pool.query<{
    id: string;
    submitted_at: Date | null;
    queued_at: Date;
    gnss_time: Date;
    status: string;
    sonuc_mesaji: string | null;
    last_error: string | null;
  }>(
    `SELECT submission.id,
            submission.submitted_at,
            submission.queued_at,
            submission.gnss_time,
            submission.status,
            submission.sonuc_mesaji,
            submission.last_error
     FROM gps_ats_submission_notifications link
     JOIN gps_ats_submissions submission ON submission.id = link.submission_id
     WHERE link.notification_id = $1
     ORDER BY submission.queued_at DESC, submission.id DESC
     LIMIT $2 OFFSET $3`,
    [notificationId, ATS_HISTORY_PAGE_SIZE + 1, offset],
  );
  const pageRows = rows.rows.slice(0, ATS_HISTORY_PAGE_SIZE);
  return {
    succeeded: counts.rows[0]?.succeeded ?? 0,
    failed: counts.rows[0]?.failed ?? 0,
    page: safePage,
    hasMore: rows.rows.length > ATS_HISTORY_PAGE_SIZE,
    rows: pageRows.map((row) => ({
      id: row.id,
      sentAt: (row.submitted_at ?? row.queued_at).toISOString(),
      gnssTime: row.gnss_time.toISOString(),
      status: row.status === "succeeded" || row.status === "failed" || row.status === "blocked"
        ? row.status
        : "pending",
      error: row.status === "succeeded" ? null : (row.last_error || row.sonuc_mesaji || null),
    })),
  };
}
