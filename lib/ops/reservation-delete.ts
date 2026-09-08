import "server-only";

import { getPool } from "@/lib/db/postgres";
import { writeOpsRecordAudits } from "@/lib/ops/record-audit";
import {
  assertNoReservationChildOrphans,
  cleanupReservationChildrenForIds,
} from "@/lib/ops/reservation-lifecycle-delete";

export type SoftDeleteReservationResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "already-deleted" | "failed" };

/**
 * Admin “Sil”: soft-delete the reservation row and hard-delete its
 * passengers + payment/refund/settlement children in the same transaction.
 * Scoped to this reservation id only (shared lifecycle helper).
 */
export async function softDeleteReservation(
  opsUserId: string,
  reservationId: string,
): Promise<SoftDeleteReservationResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      reservation_code: string;
      deleted_at: Date | null;
    }>(
      `SELECT id, reservation_code, deleted_at
       FROM reservations
       WHERE id = $1
       FOR UPDATE`,
      [reservationId],
    );
    const row = locked.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-found" };
    }
    if (row.deleted_at) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "already-deleted" };
    }

    await cleanupReservationChildrenForIds(client, [reservationId]);

    await client.query(
      `UPDATE reservations
       SET deleted_at = NOW(),
           deleted_by_ops_user_id = $2
       WHERE id = $1`,
      [reservationId, opsUserId],
    );

    await assertNoReservationChildOrphans(client, {
      reservationIds: [reservationId],
    });

    await writeOpsRecordAudits(client, {
      recordKind: "reservation",
      recordId: reservationId,
      changedBy: opsUserId,
      changes: [
        {
          fieldName: "__deleted",
          oldValue: row.reservation_code,
          newValue: "deleted",
        },
      ],
    });

    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[ops] softDeleteReservation failed", {
      reservationId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
    return { ok: false, reason: "failed" };
  } finally {
    client.release();
  }
}
