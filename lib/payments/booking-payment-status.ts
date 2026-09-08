import "server-only";

import { getPool } from "@/lib/db/postgres";
import { getTurinvoiceOrder } from "@/lib/payments/turinvoice/client";
import { processTurinvoiceCallback } from "@/lib/payments/turinvoice/process-callback";
import {
  ONLINE_PAYMENT_METHOD,
  ONLINE_PAYMENT_PAID_STATUS,
  ONLINE_PAYMENT_PENDING_STATUS,
  ONLINE_PAYMENT_PROVIDER,
  RESERVATION_CONFIRMED_STATUS,
  RESERVATION_PAYMENT_PENDING_STATUS,
} from "@/lib/payments/online-payment";
import { requireTurinvoiceConfig } from "@/lib/payments/turinvoice/config";

export type BookingPaymentStatusView = {
  reservationId: string;
  reservationCode: string;
  status: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paid: boolean;
  pendingPayment: boolean;
};

const RESERVATION_SESSION_OWNERSHIP = `
  (
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
`;

export async function loadBookingPaymentStatus(
  reservationId: string,
  browserSessionId: string,
): Promise<BookingPaymentStatusView | null> {
  const result = await getPool().query<{
    id: string;
    reservation_code: string;
    status: string;
    payment_method: string | null;
    payment_status: string | null;
    payment_provider_order_id: string | null;
    payment_amount: string | null;
    payment_currency: string | null;
    total_price: string | null;
    currency: string | null;
  }>(
    `SELECT
        r.id,
        r.reservation_code,
        r.status,
        r.payment_method,
        r.payment_status,
        r.payment_provider_order_id,
        r.payment_amount::text,
        r.payment_currency,
        r.total_price::text,
        r.currency
     FROM reservations r
     WHERE r.id = $1
       AND r.deleted_at IS NULL
       AND ${RESERVATION_SESSION_OWNERSHIP}
     LIMIT 1`,
    [reservationId, browserSessionId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const pendingAdditional = await getPool().query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM reservation_payment_transactions
     WHERE reservation_id = $1
       AND kind = 'additional_payment'
       AND status = 'pending'
     LIMIT 1`,
    [reservationId],
  );
  const hasPendingAdditional = Boolean(pendingAdditional.rows[0]);
  const pendingPayment =
    (row.payment_method === ONLINE_PAYMENT_METHOD &&
      (row.payment_status === ONLINE_PAYMENT_PENDING_STATUS ||
        row.status === RESERVATION_PAYMENT_PENDING_STATUS)) ||
    hasPendingAdditional;
  const paid =
    !hasPendingAdditional &&
    (row.payment_method !== ONLINE_PAYMENT_METHOD ||
      (row.payment_status === ONLINE_PAYMENT_PAID_STATUS &&
        row.status === RESERVATION_CONFIRMED_STATUS));
  return {
    reservationId: row.id,
    reservationCode: row.reservation_code,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paid,
    pendingPayment,
  };
}

/**
 * Optional fallback when the user lands on success before the callback arrives.
 * Does not poll aggressively — caller should space requests.
 */
export async function refreshPendingPaymentFromProvider(
  reservationId: string,
  browserSessionId: string,
): Promise<BookingPaymentStatusView | null> {
  const current = await loadBookingPaymentStatus(reservationId, browserSessionId);
  if (!current || !current.pendingPayment) {
    return current;
  }

  const result = await getPool().query<{
    payment_provider_order_id: string | null;
    payment_amount: string | null;
    payment_currency: string | null;
    total_price: string | null;
    currency: string | null;
  }>(
    `SELECT
        r.payment_provider_order_id,
        r.payment_amount::text,
        r.payment_currency,
        r.total_price::text,
        r.currency
     FROM reservations r
     WHERE r.id = $1
       AND r.deleted_at IS NULL
       AND ${RESERVATION_SESSION_OWNERSHIP}
     LIMIT 1`,
    [reservationId, browserSessionId],
  );
  const row = result.rows[0];
  const idOrder = row?.payment_provider_order_id?.trim();
  if (!idOrder) {
    return current;
  }

  try {
    requireTurinvoiceConfig();
    const order = await getTurinvoiceOrder(idOrder);
    if ((order.state ?? "").toLowerCase() !== "paid") {
      return current;
    }
    const amount =
      order.amount ??
      (row.payment_amount != null ? Number(row.payment_amount) : Number(row.total_price));
    const currency =
      order.currency ?? row.payment_currency ?? row.currency ?? "";
    await processTurinvoiceCallback({
      idOrder,
      state: "paid",
      amount: Number(amount),
      currency,
      datePay: null,
      secretKey: requireTurinvoiceConfig().callbackSecret,
    });
  } catch (error) {
    console.error("[Turinvoice] status fallback failed", error);
  }

  return loadBookingPaymentStatus(reservationId, browserSessionId);
}
