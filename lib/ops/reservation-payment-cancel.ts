import "server-only";

import { getPool } from "@/lib/db/postgres";
import { writeOpsRecordAudits } from "@/lib/ops/record-audit";
import {
  markPaymentTransactionCancelled,
  syncReservationPaymentSummary,
} from "@/lib/payments/ledger/store";
import { PAYMENT_TXN_PENDING } from "@/lib/payments/ledger/math";
import { ONLINE_PAYMENT_METHOD } from "@/lib/payments/online-payment";
import { cancelTurinvoiceOrder } from "@/lib/payments/turinvoice/client";

export type RequestOpsPaymentTxnCancelResult =
  | { ok: true; providerOrderId: string }
  | {
      ok: false;
      reason:
        | "not-found"
        | "deleted"
        | "not-pending"
        | "already-cancelled"
        | "missing-order-id"
        | "provider"
        | "failed";
    };

/**
 * Cancel a pending/unpaid Turinvoice payment transaction.
 * Provider DELETE must succeed before local status becomes cancelled.
 */
export async function requestOpsPaymentTransactionCancel(
  opsUserId: string,
  reservationId: string,
  paymentTransactionId: string,
): Promise<RequestOpsPaymentTxnCancelResult> {
  const client = await getPool().connect();
  let providerOrderId: string | null = null;
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      deleted_at: Date | null;
      payment_method: string | null;
    }>(
      `SELECT id, deleted_at, payment_method
       FROM reservations
       WHERE id = $1
       FOR UPDATE`,
      [reservationId],
    );
    const reservation = locked.rows[0];
    if (!reservation) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-found" };
    }
    if (reservation.deleted_at) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "deleted" };
    }
    if ((reservation.payment_method ?? "").trim() !== ONLINE_PAYMENT_METHOD) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "failed" };
    }

    const txn = await client.query<{
      id: string;
      status: string;
      provider_order_id: string | null;
    }>(
      `SELECT id, status, provider_order_id
       FROM reservation_payment_transactions
       WHERE id = $1 AND reservation_id = $2
       FOR UPDATE`,
      [paymentTransactionId, reservationId],
    );
    const payment = txn.rows[0];
    if (!payment) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-found" };
    }
    const status = (payment.status ?? "").trim().toLowerCase();
    if (status === "cancelled") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "already-cancelled" };
    }
    if (status !== PAYMENT_TXN_PENDING) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-pending" };
    }
    providerOrderId = payment.provider_order_id?.trim() || null;
    if (!providerOrderId) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "missing-order-id" };
    }

    // Release the row lock before the provider HTTP call.
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[ops] payment cancel lock failed", error);
    return { ok: false, reason: "failed" };
  } finally {
    client.release();
  }

  try {
    await cancelTurinvoiceOrder(providerOrderId!);
  } catch (error) {
    console.error("[ops] Turinvoice order cancel failed", {
      reservationId,
      paymentTransactionId,
      providerOrderId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
    return { ok: false, reason: "provider" };
  }

  const apply = await getPool().connect();
  try {
    await apply.query("BEGIN");
    const stillPending = await apply.query<{ id: string }>(
      `SELECT id
       FROM reservation_payment_transactions
       WHERE id = $1
         AND reservation_id = $2
         AND status = $3
       FOR UPDATE`,
      [paymentTransactionId, reservationId, PAYMENT_TXN_PENDING],
    );
    if (!stillPending.rows[0]) {
      await apply.query("ROLLBACK");
      return { ok: false, reason: "not-pending" };
    }

    const cancelled = await markPaymentTransactionCancelled(
      apply,
      paymentTransactionId,
    );
    if (!cancelled) {
      await apply.query("ROLLBACK");
      return { ok: false, reason: "not-pending" };
    }

    await syncReservationPaymentSummary(apply, reservationId);
    await writeOpsRecordAudits(apply, {
      recordKind: "reservation",
      recordId: reservationId,
      changedBy: opsUserId,
      changes: [
        {
          fieldName: "payment_order_cancel",
          oldValue: JSON.stringify({
            paymentTransactionId,
            providerOrderId,
            status: "pending",
          }),
          newValue: JSON.stringify({
            paymentTransactionId,
            providerOrderId,
            status: "cancelled",
          }),
        },
      ],
    });
    await apply.query("COMMIT");
    return { ok: true, providerOrderId: providerOrderId! };
  } catch (error) {
    try {
      await apply.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[ops] payment cancel local apply failed", error);
    return { ok: false, reason: "failed" };
  } finally {
    apply.release();
  }
}
