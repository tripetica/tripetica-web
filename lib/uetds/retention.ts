import "server-only";
import type { QueryResult } from "pg";
import { getPool } from "@/lib/db/postgres";
import { formatUtcToIstanbulLocal } from "@/lib/booking/istanbul-time";
import { isUetdsRetentionExpired, uetdsTripTimestamp, UETDS_RETENTION_AFTER_MS } from "@/lib/uetds/list-policy";

/** Local DB only. Never use the manual cancellation/deletion or Ministry modules here. */
export async function deleteExpiredUetdsNotifications(now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error("invalid_retention_clock");
  const cutoffDate = formatUtcToIstanbulLocal(now - UETDS_RETENTION_AFTER_MS).slice(0, 10);
  const client = await getPool().connect();
  let cursor: string | null = null;
  let deleted = 0;
  try {
    for (;;) {
      await client.query("BEGIN");
      const batch: QueryResult<{ id: string; end_date: string | null; end_time: string | null }> = await client.query(
        `SELECT id, snapshot->'trip'->>'endDate' AS end_date, snapshot->'trip'->>'endTime' AS end_time
         FROM uetds_notifications
         WHERE ($1::uuid IS NULL OR id > $1)
           AND snapshot->'trip'->>'endDate' <= $2
           AND status <> 'updating'
         ORDER BY id LIMIT 250 FOR UPDATE SKIP LOCKED`, [cursor, cutoffDate]);
      const ids = batch.rows.filter(row => isUetdsRetentionExpired(
        uetdsTripTimestamp(row.end_date ?? "", row.end_time ?? ""), now,
      )).map(row => row.id);
      if (ids.length) {
        // Notification-owned snapshots are removed; revisions cascade via their existing FK.
        // Reservations, fleet, partners and companies are parent records, never deletion targets.
        const result = await client.query("DELETE FROM uetds_notifications WHERE id = ANY($1::uuid[]) RETURNING id", [ids]);
        deleted += result.rowCount ?? 0;
      }
      await client.query("COMMIT");
      if (batch.rows.length === 0) break;
      cursor = batch.rows[batch.rows.length - 1].id;
    }
    return { deleted };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
