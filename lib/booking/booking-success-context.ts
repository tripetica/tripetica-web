import "server-only";

import { query } from "@/lib/db/postgres";
import {
  isBookingSuccessReservationId,
  type BookingSuccessFlow,
} from "@/lib/booking/booking-success-cookie";
import { showsTourGuideOnSuccess } from "@/lib/booking/tour-guide";
import {
  ONLINE_PAYMENT_METHOD,
  ONLINE_PAYMENT_PAID_STATUS,
  ONLINE_PAYMENT_PENDING_STATUS,
  RESERVATION_CONFIRMED_STATUS,
  RESERVATION_PAYMENT_PENDING_STATUS,
} from "@/lib/payments/online-payment";

export type BookingSuccessContext = {
  reservationId: string;
  reservationCode: string;
  showTourGuideInfo: boolean;
  paymentMethod: string | null;
  paymentStatus: string | null;
  status: string;
  paid: boolean;
  pendingPayment: boolean;
  /** True when success follows a reservation edit (additional payment / update). */
  updatedViaEdit: boolean;
};

export {
  BOOKING_SUCCESS_COOKIE,
  BOOKING_SUCCESS_FLOW_COOKIE,
  BOOKING_SUCCESS_MAX_AGE_SECONDS,
  attachBookingSuccessCookie,
  isBookingSuccessReservationId,
  readBookingSuccessReservationId,
  readBookingSuccessReservationIdFromStore,
  readBookingSuccessFlowFromStore,
} from "@/lib/booking/booking-success-cookie";

/**
 * Resolves the reservation shown on /booking/success.
 * Ownership: original draft session, active/completed edit draft session,
 * or payment txn linked to this browser session's edit draft.
 */
export async function resolveBookingSuccessContext(
  browserSessionId: string,
  reservationId: string,
  flow: BookingSuccessFlow = "create",
): Promise<BookingSuccessContext | null> {
  if (!isBookingSuccessReservationId(reservationId)) {
    return null;
  }
  const result = await query<{
    id: string;
    reservation_code: string;
    service_type: string | null;
    tour_code: string | null;
    status: string;
    payment_method: string | null;
    payment_status: string | null;
  }>(
    `SELECT
        r.id,
        r.reservation_code,
        r.service_type,
        r.tour_code,
        r.status,
        r.payment_method,
        r.payment_status
     FROM reservations r
     WHERE r.id = $1
       AND r.deleted_at IS NULL
       AND (
         EXISTS (
           SELECT 1
           FROM reservation_searches s
           WHERE s.id = r.source_reservation_search_id
             AND s.browser_session_id = $2
         )
         OR EXISTS (
           SELECT 1
           FROM reservation_searches s
           WHERE s.editing_reservation_id = r.id
             AND s.browser_session_id = $2
         )
         OR EXISTS (
           SELECT 1
           FROM reservation_payment_transactions t
           INNER JOIN reservation_searches s ON s.id = t.edit_draft_id
           WHERE t.reservation_id = r.id
             AND s.browser_session_id = $2
         )
       )
     LIMIT 1`,
    [reservationId, browserSessionId],
  );
  const row = result.rows[0];
  if (!row?.reservation_code?.trim()) {
    return null;
  }
  const pendingPayment =
    row.payment_method === ONLINE_PAYMENT_METHOD &&
    (row.payment_status === ONLINE_PAYMENT_PENDING_STATUS ||
      row.status === RESERVATION_PAYMENT_PENDING_STATUS);
  const paid =
    row.payment_method !== ONLINE_PAYMENT_METHOD ||
    (row.payment_status === ONLINE_PAYMENT_PAID_STATUS &&
      row.status === RESERVATION_CONFIRMED_STATUS);

  const pendingAdditional = await query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM reservation_payment_transactions
     WHERE reservation_id = $1
       AND kind = 'additional_payment'
       AND status = 'pending'
     LIMIT 1`,
    [reservationId],
  );
  const hasPendingAdditional = Boolean(pendingAdditional.rows[0]);

  let updatedViaEdit = flow === "edit";
  if (!updatedViaEdit) {
    const editHit = await query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM reservation_edit_settlements
       WHERE reservation_id = $1
         AND mode = 'additional_payment'
         AND status IN ('pending_payment', 'committed')
         AND created_at > NOW() - INTERVAL '2 days'
       LIMIT 1`,
      [reservationId],
    );
    updatedViaEdit = Boolean(editHit.rows[0]);
  }

  return {
    reservationId: row.id,
    reservationCode: row.reservation_code.trim(),
    showTourGuideInfo: showsTourGuideOnSuccess(row.service_type, row.tour_code),
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    status: row.status,
    paid: paid && !hasPendingAdditional,
    pendingPayment: pendingPayment || hasPendingAdditional,
    updatedViaEdit,
  };
}
