import "server-only";

import { type PoolClient } from "pg";

/**
 * Queues customer/operation confirmation only for a confirmed cash booking or
 * a server-verified paid online booking. Replays are idempotent.
 */
export async function queueReservationEmails(
  client: PoolClient,
  reservationId: string,
) {
  await client.query(
    `UPDATE reservations
     SET reservation_confirmation_email_queued_at =
       COALESCE(reservation_confirmation_email_queued_at, NOW()),
         operation_notification_email_queued_at =
       COALESCE(operation_notification_email_queued_at, NOW())
     WHERE id = $1
       AND status = 'confirmed'
       AND (
         payment_method = 'cash'
         OR payment_status = 'paid'
       )
       AND (
         reservation_confirmation_email_sent_at IS NULL
         OR operation_notification_email_sent_at IS NULL
       )`,
    [reservationId],
  );
}
