import "server-only";

import { query } from "@/lib/db/postgres";
import { paymentPendingExpiryPredicateSql } from "@/lib/booking/completion-security-policy";

export const PAYMENT_PENDING_TTL_HOURS = 48;

export async function expireStalePaymentPendingReservations(input?: {
  now?: Date;
  limit?: number;
}) {
  const now = input?.now ?? new Date();
  const limit = Math.max(1, Math.min(input?.limit ?? 100, 500));
  const expiresBefore = new Date(
    now.getTime() - PAYMENT_PENDING_TTL_HOURS * 60 * 60 * 1000,
  );
  const result = await query<{ id: string }>(
    `WITH candidates AS (
       SELECT r.id
       FROM reservations r
       WHERE ${paymentPendingExpiryPredicateSql("r")}
         AND r.created_at < $1
         AND NOT EXISTS (
           SELECT 1
           FROM reservation_payment_transactions t
           WHERE t.reservation_id = r.id
             AND t.status = 'paid'
         )
       ORDER BY r.created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $2
     )
     UPDATE reservations r
     SET status = 'cancelled',
         payment_status = 'expired',
         reservation_confirmation_email_queued_at = NULL,
         operation_notification_email_queued_at = NULL
     FROM candidates
     WHERE r.id = candidates.id
       AND ${paymentPendingExpiryPredicateSql("r")}
     RETURNING r.id`,
    [expiresBefore, limit],
  );
  return { expired: result.rows.length, reservationIds: result.rows.map((row) => row.id) };
}
