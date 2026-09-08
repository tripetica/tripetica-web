import "server-only";

import { getPool } from "@/lib/db/postgres";
import { writeOpsRecordAudits } from "@/lib/ops/record-audit";

export type ReservationOpsStatus = "confirmed" | "cancelled";

export type SetReservationStatusResult =
  | { ok: true; status: ReservationOpsStatus }
  | {
      ok: false;
      reason: "not-found" | "deleted" | "unchanged" | "invalid" | "failed";
    };

export async function setReservationOpsStatus(
  opsUserId: string,
  reservationId: string,
  nextStatus: ReservationOpsStatus,
): Promise<SetReservationStatusResult> {
  if (nextStatus !== "confirmed" && nextStatus !== "cancelled") {
    return { ok: false, reason: "invalid" };
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      reservation_code: string;
      status: string;
      deleted_at: Date | null;
      cancelled_at: Date | null;
    }>(
      `SELECT id, reservation_code, status, deleted_at, cancelled_at
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
      return { ok: false, reason: "deleted" };
    }
    if (row.status === nextStatus) {
      await client.query("COMMIT");
      return { ok: false, reason: "unchanged" };
    }

    if (nextStatus === "cancelled") {
      await client.query(
        `UPDATE reservations
         SET status = 'cancelled',
             cancelled_at = COALESCE(cancelled_at, NOW())
         WHERE id = $1`,
        [reservationId],
      );
    } else {
      await client.query(
        `UPDATE reservations
         SET status = 'confirmed',
             cancelled_at = NULL
         WHERE id = $1`,
        [reservationId],
      );
    }

    await writeOpsRecordAudits(client, {
      recordKind: "reservation",
      recordId: reservationId,
      changedBy: opsUserId,
      changes: [
        {
          fieldName: "status",
          oldValue: row.status,
          newValue: nextStatus,
        },
      ],
    });

    await client.query("COMMIT");
    return { ok: true, status: nextStatus };
  } catch {
    await client.query("ROLLBACK");
    return { ok: false, reason: "failed" };
  } finally {
    client.release();
  }
}
