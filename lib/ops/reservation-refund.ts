import "server-only";

import { getPool } from "@/lib/db/postgres";
import { writeOpsRecordAudits } from "@/lib/ops/record-audit";
import {
  evaluateOpsRefundGate,
  REFUND_STATUS_FAILED,
  REFUND_STATUS_SUBMITTED,
  type OpsRefundBlockReason,
} from "@/lib/ops/refund-gate";
import {
  createAndSubmitPaymentTransactionRefund,
  createRefundBatchWithPlan,
  submitRefundBatchAllocations,
} from "@/lib/payments/ledger/refund-engine";
import { loadReservationFinancialSummary } from "@/lib/payments/ledger/store";
import { ONLINE_PAYMENT_METHOD } from "@/lib/payments/online-payment";

export type RequestOpsRefundResult =
  | {
      ok: true;
      refundStatus: typeof REFUND_STATUS_SUBMITTED;
      refundProviderRefundId: string | null;
      adminOverride: boolean;
      batchStatus?: string;
      submittedAmount?: number;
      failedAmount?: number;
    }
  | {
      ok: false;
      reason:
        | OpsRefundBlockReason
        | "not-found"
        | "deleted"
        | "provider"
        | "failed"
        | "override-required"
        | "insufficient-refundable";
    };

export type RequestOpsPaymentTxnRefundResult =
  | {
      ok: true;
      submittedAmount: number;
      providerRefundId: string | null;
    }
  | {
      ok: false;
      reason:
        | "not-found"
        | "deleted"
        | "invalid-amount"
        | "insufficient-refundable"
        | "provider"
        | "failed"
        | "not-paid";
    };

type LockedRefundRow = {
  id: string;
  status: string;
  deleted_at: Date | null;
  pickup_at: Date | null;
  service_type: string | null;
  tour_code: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_provider: string | null;
  payment_provider_order_id: string | null;
  payment_amount: string | null;
  payment_currency: string | null;
  refund_status: string | null;
  total_price: string | null;
  currency: string | null;
};

/**
 * Full cancel refund of remaining net collected amount via LIFO across payment txns.
 * On provider acceptance: allocation status=submitted only (not completed).
 */
export async function requestOpsTurinvoiceRefund(
  opsUserId: string,
  reservationId: string,
  options: { confirmAdminOverride?: boolean } = {},
): Promise<RequestOpsRefundResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<LockedRefundRow>(
      `SELECT
          id, status, deleted_at, pickup_at, service_type, tour_code,
          payment_method, payment_status, payment_provider, payment_provider_order_id,
          payment_amount::text, payment_currency, refund_status,
          total_price::text, currency
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

    const summary = await loadReservationFinancialSummary({
      reservationId: row.id,
      currentTotal: Number(row.total_price),
      currentCurrency: row.currency,
      client,
    });
    const remainingRefundable = Number(
      (
        summary.grossSuccessfulPayments -
        summary.completedRefunds -
        summary.pendingRefunds
      ).toFixed(2),
    );

    const gate = evaluateOpsRefundGate({
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      paymentProvider: row.payment_provider,
      paymentProviderOrderId: row.payment_provider_order_id,
      paymentAmount: row.payment_amount,
      paymentCurrency: row.payment_currency,
      refundStatus: row.refund_status,
      serviceType: row.service_type,
      tourCode: row.tour_code,
      pickupAt: row.pickup_at,
      remainingRefundableAmount: remainingRefundable,
    });

    if (!gate.ok) {
      await client.query("ROLLBACK");
      return { ok: false, reason: gate.reason };
    }

    if (gate.adminOverride && options.confirmAdminOverride !== true) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "override-required" };
    }

    if ((row.payment_method ?? "").trim() !== ONLINE_PAYMENT_METHOD) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "cash" };
    }

    const required = remainingRefundable;
    if (!(required > 0) || !summary.currency) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "already-refunded" };
    }

    const idempotencyKey = `ops-cancel-refund:${row.id}:${required}:${summary.currency}`;
    const batch = await createRefundBatchWithPlan(client, {
      reservationId: row.id,
      kind: "cancel_full",
      requiredAmount: required,
      currency: summary.currency,
      idempotencyKey,
      reason: gate.adminOverride
        ? "ops_admin_override_outside_window"
        : "ops_full_refund",
      adminOverride: gate.adminOverride,
      requestedByOpsUserId: opsUserId,
    });
    if (!batch.ok) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "insufficient-refundable" };
    }

    const submitted = await submitRefundBatchAllocations(
      client,
      batch.batchId,
      `Ops cancel refund ${row.id}`,
    );

    await writeOpsRecordAudits(client, {
      recordKind: "reservation",
      recordId: row.id,
      changedBy: opsUserId,
      changes: [
        {
          fieldName: "refund_status",
          oldValue: row.refund_status,
          newValue: submitted.ok
            ? REFUND_STATUS_SUBMITTED
            : REFUND_STATUS_FAILED,
        },
      ],
    });

    if (!submitted.ok) {
      await client.query("COMMIT");
      return { ok: false, reason: "provider" };
    }

    await client.query("COMMIT");
    return {
      ok: true,
      refundStatus: REFUND_STATUS_SUBMITTED,
      refundProviderRefundId:
        submitted.allocations.find((a) => a.providerRefundId)?.providerRefundId ??
        null,
      adminOverride: gate.adminOverride,
      batchStatus: submitted.status,
      submittedAmount: submitted.submittedAmount,
      failedAmount: submitted.failedAmount,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[ops-refund] failed", error);
    return { ok: false, reason: "failed" };
  } finally {
    client.release();
  }
}

/**
 * Ops payment-history refund for one Turinvoice payment transaction (partial or full remaining).
 * Does not require the reservation to be cancelled.
 */
export async function requestOpsPaymentTransactionRefund(
  opsUserId: string,
  reservationId: string,
  paymentTransactionId: string,
  amountRaw: number,
): Promise<RequestOpsPaymentTxnRefundResult> {
  const amount = Number(Number(amountRaw).toFixed(2));
  if (!Number.isFinite(amount) || !(amount > 0)) {
    return { ok: false, reason: "invalid-amount" };
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      deleted_at: Date | null;
      payment_method: string | null;
      currency: string | null;
    }>(
      `SELECT id, deleted_at, payment_method, currency
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
      currency: string;
      status: string;
      provider_order_id: string | null;
    }>(
      `SELECT id, currency, status, provider_order_id
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
    if ((payment.status ?? "").trim().toLowerCase() !== "paid") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-paid" };
    }

    const currency = payment.currency.trim().toUpperCase();
    const idempotencyKey = `ops-payment-refund:${payment.id}:${amount}:${currency}`;
    const submitted = await createAndSubmitPaymentTransactionRefund(client, {
      reservationId,
      paymentTransactionId: payment.id,
      amount,
      currency,
      idempotencyKey,
      opsUserId,
      description: `Ops payment history refund order ${payment.provider_order_id ?? payment.id}`,
    });

    await writeOpsRecordAudits(client, {
      recordKind: "reservation",
      recordId: reservationId,
      changedBy: opsUserId,
      changes: [
        {
          fieldName: "payment_refund",
          oldValue: null,
          newValue: JSON.stringify({
            paymentTransactionId: payment.id,
            providerOrderId: payment.provider_order_id,
            amount,
            currency,
            ok: submitted.ok,
          }),
        },
      ],
    });

    if (!submitted.ok) {
      await client.query("COMMIT");
      if (submitted.reason === "insufficient-balance") {
        return { ok: false, reason: "insufficient-refundable" };
      }
      if (submitted.reason === "provider") {
        return { ok: false, reason: "provider" };
      }
      return { ok: false, reason: "failed" };
    }

    await client.query("COMMIT");
    return {
      ok: true,
      submittedAmount: submitted.submittedAmount,
      providerRefundId:
        submitted.allocations.find((a) => a.providerRefundId)?.providerRefundId ??
        null,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[ops-payment-txn-refund] failed", error);
    return { ok: false, reason: "failed" };
  } finally {
    client.release();
  }
}
