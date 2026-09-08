import "server-only";

import { getPool } from "@/lib/db/postgres";
import { commitPendingEditAfterAdditionalPayment } from "@/lib/booking/edit-finalize";
import {
  findPaymentTransactionByOrderId,
  markPaymentTransactionPaid,
  syncReservationPaymentSummary,
} from "@/lib/payments/ledger/store";
import { requireTurinvoiceConfig } from "@/lib/payments/turinvoice/config";
import {
  type TurinvoiceCallbackPayload,
} from "@/lib/payments/turinvoice/callback-payload";
import {
  ONLINE_PAYMENT_METHOD,
  ONLINE_PAYMENT_PAID_STATUS,
  ONLINE_PAYMENT_PENDING_STATUS,
  ONLINE_PAYMENT_PROVIDER,
  RESERVATION_CONFIRMED_STATUS,
  RESERVATION_PAYMENT_PENDING_STATUS,
  normalizePaymentCurrency,
  paymentAmountsMatch,
} from "@/lib/payments/online-payment";
import { queueReservationEmails } from "@/lib/booking/reservation-email-queue";
import { paidCallbackQueuesReservationNotifications } from "@/lib/booking/completion-security-policy";

export type { TurinvoiceCallbackPayload } from "@/lib/payments/turinvoice/callback-payload";
export { parseTurinvoiceCallbackBody } from "@/lib/payments/turinvoice/callback-payload";

export type ProcessCallbackResult =
  | {
      ok: true;
      outcome: "paid" | "ignored" | "already-paid";
      reservationId?: string;
      sendPaymentConfirmation?: boolean;
      sendReservationNotifications?: boolean;
    }
  | { ok: false; reason: "unauthorized" | "not-found" | "mismatch" | "invalid" };

export async function processTurinvoiceCallback(
  payload: TurinvoiceCallbackPayload,
): Promise<ProcessCallbackResult> {
  const config = requireTurinvoiceConfig();
  if (payload.secretKey !== config.callbackSecret) {
    console.error("[Turinvoice callback] invalid secret_key");
    return { ok: false, reason: "unauthorized" };
  }

  if (payload.state !== "paid") {
    return { ok: true, outcome: "ignored" };
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // Prefer ledger lookup (supports P2+ additional payments).
    const txn = await findPaymentTransactionByOrderId(client, payload.idOrder);
    if (txn) {
      const expectedAmount = Number(txn.amount);
      const expectedCurrency = normalizePaymentCurrency(txn.currency);
      const actualCurrency = normalizePaymentCurrency(payload.currency);
      if (
        !Number.isFinite(expectedAmount) ||
        !paymentAmountsMatch(expectedAmount, payload.amount) ||
        expectedCurrency !== actualCurrency
      ) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "mismatch" };
      }

      if (txn.status === "paid") {
        if (paidCallbackQueuesReservationNotifications(txn.kind)) {
          await queueReservationEmails(client, txn.reservation_id);
        }
        await client.query("COMMIT");
        return {
          ok: true,
          outcome: "already-paid",
          reservationId: txn.reservation_id,
          sendPaymentConfirmation:
            paidCallbackQueuesReservationNotifications(txn.kind),
          sendReservationNotifications:
            paidCallbackQueuesReservationNotifications(txn.kind),
        };
      }

      let paidAt: Date | null = null;
      if (payload.datePay) {
        const parsed = new Date(payload.datePay);
        if (!Number.isNaN(parsed.getTime())) {
          paidAt = parsed;
        }
      }

      await markPaymentTransactionPaid(client, txn.id, paidAt);

      if (txn.kind === "additional_payment") {
        await commitPendingEditAfterAdditionalPayment(client, {
          reservationId: txn.reservation_id,
          paymentTransactionId: txn.id,
          editDraftId: txn.edit_draft_id,
          editSettlementId: txn.edit_settlement_id,
        });
        await client.query(
          `UPDATE reservations
           SET payment_status = $2,
               status = CASE
                 WHEN status = $3 THEN $4
                 ELSE status
               END,
               paid_at = COALESCE(paid_at, COALESCE($5::timestamptz, NOW())),
               confirmed_at = COALESCE(confirmed_at, NOW())
           WHERE id = $1`,
          [
            txn.reservation_id,
            ONLINE_PAYMENT_PAID_STATUS,
            RESERVATION_PAYMENT_PENDING_STATUS,
            RESERVATION_CONFIRMED_STATUS,
            paidAt,
          ],
        );
      } else {
        await client.query(
          `UPDATE reservations
           SET payment_status = $2,
               status = $3,
               paid_at = COALESCE($4::timestamptz, NOW()),
               confirmed_at = COALESCE(confirmed_at, NOW())
           WHERE id = $1
             AND payment_method = $5
             AND payment_provider = $6`,
          [
            txn.reservation_id,
            ONLINE_PAYMENT_PAID_STATUS,
            RESERVATION_CONFIRMED_STATUS,
            paidAt,
            ONLINE_PAYMENT_METHOD,
            ONLINE_PAYMENT_PROVIDER,
          ],
        );
      }

      await syncReservationPaymentSummary(client, txn.reservation_id);
      if (paidCallbackQueuesReservationNotifications(txn.kind)) {
        await queueReservationEmails(client, txn.reservation_id);
      }
      await client.query("COMMIT");
      return {
        ok: true,
        outcome: "paid",
        reservationId: txn.reservation_id,
        sendPaymentConfirmation:
          paidCallbackQueuesReservationNotifications(txn.kind),
        sendReservationNotifications:
          paidCallbackQueuesReservationNotifications(txn.kind),
      };
    }

    // Legacy path: order id only on reservations row (pre-ledger).
    const locked = await client.query<{
      id: string;
      status: string;
      payment_method: string | null;
      payment_status: string | null;
      payment_provider: string | null;
      payment_amount: string | null;
      payment_currency: string | null;
      total_price: string | null;
      currency: string | null;
      reservation_code: string;
    }>(
      `SELECT
          id,
          status,
          payment_method,
          payment_status,
          payment_provider,
          payment_amount::text,
          payment_currency,
          total_price::text,
          currency,
          reservation_code
       FROM reservations
       WHERE payment_provider_order_id = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [payload.idOrder],
    );
    const row = locked.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-found" };
    }

    if (
      row.payment_status === ONLINE_PAYMENT_PAID_STATUS &&
      row.status === RESERVATION_CONFIRMED_STATUS
    ) {
      await queueReservationEmails(client, row.id);
      await client.query("COMMIT");
      return {
        ok: true,
        outcome: "already-paid",
        reservationId: row.id,
        sendPaymentConfirmation: true,
        sendReservationNotifications: true,
      };
    }

    if (
      row.payment_method !== ONLINE_PAYMENT_METHOD ||
      row.payment_provider !== ONLINE_PAYMENT_PROVIDER
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid" };
    }

    const expectedAmount = Number(row.payment_amount ?? row.total_price);
    const expectedCurrency = normalizePaymentCurrency(
      row.payment_currency ?? row.currency,
    );
    const actualCurrency = normalizePaymentCurrency(payload.currency);
    if (
      !Number.isFinite(expectedAmount) ||
      !paymentAmountsMatch(expectedAmount, payload.amount) ||
      expectedCurrency !== actualCurrency
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "mismatch" };
    }

    let paidAt: Date | null = null;
    if (payload.datePay) {
      const parsed = new Date(payload.datePay);
      if (!Number.isNaN(parsed.getTime())) {
        paidAt = parsed;
      }
    }

    await client.query(
      `UPDATE reservations
       SET payment_status = $2,
           status = $3,
           paid_at = COALESCE($4::timestamptz, NOW()),
           confirmed_at = COALESCE(confirmed_at, NOW())
       WHERE id = $1
         AND (
           (payment_status = $5 AND status = $6)
           OR (
             payment_status = 'expired'
             AND status = 'cancelled'
             AND paid_at IS NULL
             AND confirmed_at IS NULL
           )
         )`,
      [
        row.id,
        ONLINE_PAYMENT_PAID_STATUS,
        RESERVATION_CONFIRMED_STATUS,
        paidAt,
        ONLINE_PAYMENT_PENDING_STATUS,
        RESERVATION_PAYMENT_PENDING_STATUS,
      ],
    );

    // Best-effort P1 ledger row for legacy orders.
    try {
      const { insertPaymentTransaction } = await import(
        "@/lib/payments/ledger/store"
      );
      await insertPaymentTransaction(client, {
        reservationId: row.id,
        reservationCode: row.reservation_code,
        sequenceNo: 1,
        kind: "initial_payment",
        amount: expectedAmount,
        currency: expectedCurrency,
        status: "paid",
        idempotencyKey: `callback:legacy-p1:${row.id}`,
        providerOrderId: payload.idOrder,
        paidAt,
      });
      await syncReservationPaymentSummary(client, row.id);
    } catch {
      // Ledger table may not exist yet during rolling deploy.
    }

    await queueReservationEmails(client, row.id);
    await client.query("COMMIT");
    return {
      ok: true,
      outcome: "paid",
      reservationId: row.id,
      sendPaymentConfirmation: true,
      sendReservationNotifications: true,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
