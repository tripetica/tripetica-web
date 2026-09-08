import "server-only";

import { VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL } from "@/lib/account/customer-reservation-access-policy";
import { evaluateCustomerCancel } from "@/lib/account/customer-status-policy";
import { getPool } from "@/lib/db/postgres";
import {
  createRefundBatchWithPlan,
  submitRefundBatchAllocations,
} from "@/lib/payments/ledger/refund-engine";
import {
  listPaymentTransactions,
  loadReservationFinancialSummary,
  markPaymentTransactionCancelled,
  syncReservationPaymentSummary,
} from "@/lib/payments/ledger/store";
import {
  PAYMENT_TXN_PENDING,
  remainingRefundableFromSummary,
} from "@/lib/payments/ledger/math";
import { ONLINE_PAYMENT_METHOD } from "@/lib/payments/online-payment";
import { cancelTurinvoiceOrder } from "@/lib/payments/turinvoice/client";

export type CancelCustomerReservationResult =
  | { ok: true; status: "cancelled" }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "not-found"
        | "unchanged"
        | "invalid"
        | "within_six_hours"
        | "already_cancelled"
        | "refund_failed"
        | "pending_cancel_failed"
        | "failed";
    };

/**
 * Customer cancel: enforce >6h window, refund 100% of remaining net collected
 * across payment ledger (LIFO), cancel pending Turinvoice orders, then mark
 * reservation cancelled. Never marks cancelled if required refunds fail.
 */
export async function cancelCustomerReservation(input: {
  userId: string;
  reservationId: string;
}): Promise<CancelCustomerReservationResult> {
  const client = await getPool().connect();
  let pendingToCancel: Array<{ id: string; providerOrderId: string }> = [];

  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      status: string;
      deleted_at: Date | null;
      pickup_at: Date | null;
      payment_method: string | null;
      total_price: string | null;
      currency: string | null;
    }>(
      `SELECT id, status, deleted_at, pickup_at, payment_method,
              total_price::text, currency
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
    if ((row.status ?? "").trim().toLowerCase() === "cancelled") {
      await client.query("COMMIT");
      return { ok: false, reason: "unchanged" };
    }

    const gate = evaluateCustomerCancel({
      status: row.status,
      pickupAt: row.pickup_at,
    });
    if (!gate.allowed) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason:
          gate.reason === "within_six_hours"
            ? "within_six_hours"
            : "already_cancelled",
      };
    }

    const isOnline =
      (row.payment_method ?? "").trim() === ONLINE_PAYMENT_METHOD;
    const total =
      row.total_price != null && Number.isFinite(Number(row.total_price))
        ? Number(row.total_price)
        : null;

    if (isOnline) {
      const summary = await loadReservationFinancialSummary({
        reservationId: row.id,
        currentTotal: total,
        currentCurrency: row.currency,
        client,
      });
      const required = remainingRefundableFromSummary(summary);

      if (required > 0) {
        if (!summary.currency) {
          await client.query("ROLLBACK");
          return { ok: false, reason: "refund_failed" };
        }
        // Stable key (no amount) so retries reuse the same batch instead of
        // creating a second full-refund plan for the same cancel.
        const idempotencyKey = `customer-cancel-refund:${row.id}`;
        const batch = await createRefundBatchWithPlan(client, {
          reservationId: row.id,
          kind: "cancel_full",
          requiredAmount: required,
          currency: summary.currency,
          idempotencyKey,
          reason: "customer_cancel_full_refund",
          requestedByCustomerUserId: input.userId,
        });
        if (!batch.ok) {
          await client.query("ROLLBACK");
          return { ok: false, reason: "refund_failed" };
        }

        const submitted = await submitRefundBatchAllocations(
          client,
          batch.batchId,
          `Customer cancel refund ${row.id}`,
        );
        if (!submitted.ok || submitted.failedAmount > 0) {
          // Keep failed/partial refund rows for payment history; do not cancel.
          await client.query("COMMIT");
          return { ok: false, reason: "refund_failed" };
        }
      }

      const payments = await listPaymentTransactions(row.id, client);
      pendingToCancel = payments
        .filter(
          (payment) =>
            payment.status === PAYMENT_TXN_PENDING &&
            Boolean(payment.providerOrderId?.trim()),
        )
        .map((payment) => ({
          id: payment.id,
          providerOrderId: payment.providerOrderId!.trim(),
        }));
    }

    // Commit financial work before provider pending cancels (HTTP outside txn).
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[customer-cancel] lock/refund failed", error);
    return { ok: false, reason: "failed" };
  } finally {
    client.release();
  }

  for (const pending of pendingToCancel) {
    try {
      await cancelTurinvoiceOrder(pending.providerOrderId);
    } catch (error) {
      console.error("[customer-cancel] pending Turinvoice cancel failed", {
        reservationId: input.reservationId,
        paymentTransactionId: pending.id,
        providerOrderId: pending.providerOrderId,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : error,
      });
      return { ok: false, reason: "pending_cancel_failed" };
    }

    const apply = await getPool().connect();
    try {
      await apply.query("BEGIN");
      const cancelled = await markPaymentTransactionCancelled(apply, pending.id);
      if (cancelled) {
        await syncReservationPaymentSummary(apply, input.reservationId);
      }
      await apply.query("COMMIT");
    } catch (error) {
      try {
        await apply.query("ROLLBACK");
      } catch {
        // ignore
      }
      console.error("[customer-cancel] pending local cancel failed", error);
      return { ok: false, reason: "pending_cancel_failed" };
    } finally {
      apply.release();
    }
  }

  const finalize = await getPool().connect();
  try {
    await finalize.query("BEGIN");
    const locked = await finalize.query<{
      id: string;
      status: string;
      pickup_at: Date | null;
    }>(
      `SELECT id, status, pickup_at
       FROM reservations r
       WHERE r.id = $2
         AND r.deleted_at IS NULL
         AND ${VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL}
       FOR UPDATE`,
      [input.userId, input.reservationId],
    );
    const row = locked.rows[0];
    if (!row) {
      await finalize.query("ROLLBACK");
      return { ok: false, reason: "not-found" };
    }
    if ((row.status ?? "").trim().toLowerCase() === "cancelled") {
      await finalize.query("COMMIT");
      return { ok: true, status: "cancelled" };
    }

    // Re-check window in case time elapsed during refund/provider calls.
    const gate = evaluateCustomerCancel({
      status: row.status,
      pickupAt: row.pickup_at,
    });
    if (!gate.allowed) {
      await finalize.query("ROLLBACK");
      return {
        ok: false,
        reason:
          gate.reason === "within_six_hours"
            ? "within_six_hours"
            : "already_cancelled",
      };
    }

    await finalize.query(
      `UPDATE reservations
       SET status = 'cancelled',
           cancelled_at = COALESCE(cancelled_at, NOW())
       WHERE id = $1`,
      [row.id],
    );
    await finalize.query("COMMIT");
    return { ok: true, status: "cancelled" };
  } catch (error) {
    try {
      await finalize.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[customer-cancel] finalize failed", error);
    return { ok: false, reason: "failed" };
  } finally {
    finalize.release();
  }
}
