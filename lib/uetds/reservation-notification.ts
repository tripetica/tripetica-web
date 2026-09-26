import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { UETDS_ACTIVE_NOTIFICATION_STATUSES } from "@/lib/uetds/reservation-notification-state";

export {
  UETDS_ACTIVE_NOTIFICATION_STATUSES,
  isActiveUetdsNotificationStatus,
  uetdsReservationNotifyPath,
} from "@/lib/uetds/reservation-notification-state";

export type UetdsActiveReservationNotification = {
  id: string;
  status: string;
  ministryReference: string | null;
  partnerId: string;
};

export async function findActiveUetdsNotificationForReservation(input: {
  reservationId: string;
  partnerId?: string | null;
}): Promise<UetdsActiveReservationNotification | null> {
  if (!isUuid(input.reservationId) || (input.partnerId && !isUuid(input.partnerId))) {
    return null;
  }
  const result = await query<{
    id: string;
    status: string;
    ministry_reference: string | null;
    partner_id: string;
  }>(
    `SELECT id, status, ministry_reference, partner_id
     FROM uetds_notifications
     WHERE reservation_id = $1
       AND status = ANY($2::text[])
       AND ($3::uuid IS NULL OR partner_id = $3)
     ORDER BY
       CASE WHEN ministry_reference IS NOT NULL THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT 1`,
    [input.reservationId, [...UETDS_ACTIVE_NOTIFICATION_STATUSES], input.partnerId ?? null],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    status: row.status,
    ministryReference: row.ministry_reference,
    partnerId: row.partner_id,
  };
}
