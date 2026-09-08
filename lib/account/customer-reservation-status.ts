import "server-only";

import { getPool } from "@/lib/db/postgres";
import { VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL } from "@/lib/account/customer-reservation-access-policy";
import { cancelCustomerReservation } from "@/lib/account/customer-cancel";
import {
  evaluateCustomerReactivate,
} from "@/lib/account/customer-status-policy";

export type CustomerReservationStatus = "confirmed" | "cancelled";

export type SetCustomerReservationStatusResult =
  | { ok: true; status: CustomerReservationStatus }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "not-found"
        | "unchanged"
        | "invalid"
        | "within_six_hours"
        | "bosphorus_after_cutoff"
        | "already_cancelled"
        | "not_cancelled"
        | "refund_failed"
        | "pending_cancel_failed"
        | "failed";
    };

/**
 * Updates reservations.status with ownership + customer cancel/reactivate policy.
 * Cancel path runs refund + pending order cancel via cancelCustomerReservation.
 */
export async function setCustomerReservationStatus(input: {
  userId: string;
  reservationId: string;
  nextStatus: CustomerReservationStatus;
}): Promise<SetCustomerReservationStatusResult> {
  if (input.nextStatus !== "confirmed" && input.nextStatus !== "cancelled") {
    return { ok: false, reason: "invalid" };
  }

  if (input.nextStatus === "cancelled") {
    const result = await cancelCustomerReservation({
      userId: input.userId,
      reservationId: input.reservationId,
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, status: "cancelled" };
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      status: string;
      deleted_at: Date | null;
      pickup_at: Date | null;
      service_type: string | null;
      tour_code: string | null;
    }>(
      `SELECT id, status, deleted_at, pickup_at, service_type, tour_code
       FROM reservations r
       WHERE r.id = $2
         AND r.deleted_at IS NULL
         AND ${VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL}
       FOR UPDATE`,
      [input.userId, input.reservationId],
    );
    const row = locked.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-found" };
    }
    if (row.status === input.nextStatus) {
      await client.query("COMMIT");
      return { ok: false, reason: "unchanged" };
    }

    const gate = evaluateCustomerReactivate({
      status: row.status,
      serviceType: row.service_type,
      tourCode: row.tour_code,
      pickupAt: row.pickup_at,
    });
    if (!gate.allowed) {
      await client.query("ROLLBACK");
      return { ok: false, reason: gate.reason };
    }
    await client.query(
      `UPDATE reservations
       SET status = 'confirmed',
           cancelled_at = NULL
       WHERE id = $1`,
      [row.id],
    );

    await client.query("COMMIT");
    return { ok: true, status: "confirmed" };
  } catch {
    await client.query("ROLLBACK");
    return { ok: false, reason: "failed" };
  } finally {
    client.release();
  }
}
