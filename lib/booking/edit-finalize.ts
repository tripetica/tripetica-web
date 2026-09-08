import "server-only";

import { cookies } from "next/headers";
import { getPool } from "@/lib/db/postgres";
import { applyEditDraftToReservation } from "@/lib/booking/apply-edit-draft";
import {
  BROWSER_SESSION_COOKIE,
  isBrowserSessionId,
} from "@/lib/booking/browser-session";
import { checkoutCanComplete } from "@/lib/booking/checkout-complete";
import { isPrimaryPassengerReady } from "@/lib/booking/complete-reservation-validation";
import { isValidEmail } from "@/lib/booking/phone";
import {
  findActiveDraftWithClient,
} from "@/lib/booking/reservation-search";
import { resolveStoredPriceAmount } from "@/lib/ops/price-override";
import { computeEditFinanceSettlement } from "@/lib/payments/ledger/math";
import {
  createRefundBatchWithPlan,
  submitRefundBatchAllocations,
} from "@/lib/payments/ledger/refund-engine";
import {
  insertPaymentTransaction,
  loadReservationFinancialSummary,
  nextPaymentSequence,
  syncReservationPaymentSummary,
} from "@/lib/payments/ledger/store";
import { ensureTurinvoiceOrderForPaymentTransaction } from "@/lib/payments/turinvoice/ensure-order";
import {
  ONLINE_PAYMENT_METHOD,
  isSbpAllowedCurrency,
  normalizePaymentCurrency,
} from "@/lib/payments/online-payment";

export type EditFinalizeReview = {
  mode: "cash_update" | "zero_diff" | "additional_payment" | "refund";
  reservationCode: string;
  newTotal: number;
  newCurrency: string;
  netCollected: number;
  collectedCurrency: string | null;
  amountDue: number;
  amountRefund: number;
  cashPayableTotal: number | null;
};

export type EditFinalizeResult =
  | {
      ok: true;
      outcome: "committed";
      reservationId: string;
      reservationCode: string;
      mode: EditFinalizeReview["mode"];
      review: EditFinalizeReview;
    }
  | {
      ok: true;
      outcome: "payment_required";
      reservationId: string;
      reservationCode: string;
      paymentUrl: string;
      amountDue: number;
      currency: string;
      review: EditFinalizeReview;
    }
  | {
      ok: false;
      reason:
        | "unauthenticated-session"
        | "not-found"
        | "not-edit-draft"
        | "forbidden"
        | "invalid"
        | "legal_required"
        | "checkout"
        | "insufficient-refundable"
        | "provider"
        | "failed";
      review?: EditFinalizeReview;
    };

function money(value: number) {
  return Number(value.toFixed(2));
}

async function auditOpsEditIfNeeded(
  client: import("pg").PoolClient,
  draft: Awaited<ReturnType<typeof findActiveDraftWithClient>>,
  reservationId: string,
  mode: EditFinalizeReview["mode"],
) {
  const opsUserId = draft?.editingOriginal?.opsUserId;
  if (!opsUserId) {
    return;
  }
  const { writeOpsRecordAudits } = await import("@/lib/ops/record-audit");
  await writeOpsRecordAudits(client, {
    recordKind: "reservation",
    recordId: reservationId,
    changedBy: opsUserId,
    changes: [
      {
        fieldName: "ops_booking_funnel_edit",
        oldValue: draft.editingOriginal?.reservationCode ?? null,
        newValue: mode,
      },
    ],
  });
}

async function readBrowserSessionId() {
  const jar = await cookies();
  const value = jar.get(BROWSER_SESSION_COOKIE)?.value;
  return isBrowserSessionId(value) ? value : null;
}

export async function buildEditFinalizeReview(
  browserSessionId: string,
): Promise<
  | { ok: true; review: EditFinalizeReview; reservationId: string; draftId: string }
  | { ok: false; reason: "not-found" | "not-edit-draft" | "invalid" }
> {
  const client = await getPool().connect();
  try {
    const draft = await findActiveDraftWithClient(client, browserSessionId);
    if (!draft) {
      return { ok: false, reason: "not-found" };
    }
    if (!draft.editingOriginal) {
      return { ok: false, reason: "not-edit-draft" };
    }
    const price = resolveStoredPriceAmount({
      currency: draft.currency,
      appliedVehicleTotal: draft.appliedVehicleTotal,
      fxSnapshot: draft.appliedFxSnapshot,
      priceManuallyOverridden: draft.priceManuallyOverridden,
      manualPriceTotals: draft.manualPriceTotals,
    });
    if (price.amount == null || !price.currency) {
      return { ok: false, reason: "invalid" };
    }
    const newTotal = Number(price.amount);
    if (!Number.isFinite(newTotal)) {
      return { ok: false, reason: "invalid" };
    }
    const newCurrency = normalizePaymentCurrency(price.currency);
    if (!newCurrency) {
      return { ok: false, reason: "invalid" };
    }

    const reservation = await client.query<{
      id: string;
      reservation_code: string;
      payment_method: string | null;
      total_price: string | null;
      currency: string | null;
    }>(
      `SELECT id, reservation_code, payment_method, total_price::text, currency
       FROM reservations
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [draft.editingOriginal.reservationId],
    );
    const row = reservation.rows[0];
    if (!row) {
      return { ok: false, reason: "not-found" };
    }

    const method = (row.payment_method ?? "").trim().toLowerCase();
    if (method !== ONLINE_PAYMENT_METHOD && method !== "cash") {
      return { ok: false, reason: "invalid" };
    }

    if (method === "cash") {
      return {
        ok: true,
        reservationId: row.id,
        draftId: draft.id,
        review: {
          mode: "cash_update",
          reservationCode: row.reservation_code,
          newTotal,
          newCurrency,
          netCollected: 0,
          collectedCurrency: null,
          amountDue: 0,
          amountRefund: 0,
          cashPayableTotal: newTotal,
        },
      };
    }

    const summary = await loadReservationFinancialSummary({
      reservationId: row.id,
      currentTotal: newTotal,
      currentCurrency: newCurrency,
      client,
    });
    const net = summary.netCollectedAmount;
    const collectedCurrency =
      normalizePaymentCurrency(summary.currency) || newCurrency;
    // Compare in payment currency when same; otherwise require same currency for Stage 3.
    if (
      collectedCurrency &&
      collectedCurrency !== newCurrency &&
      net > 0
    ) {
      // Still allow comparison only when currencies match provider snapshot.
      return { ok: false, reason: "invalid" };
    }

    const settlement = computeEditFinanceSettlement(net, newTotal);

    return {
      ok: true,
      reservationId: row.id,
      draftId: draft.id,
      review: {
        mode: settlement.mode,
        reservationCode: row.reservation_code,
        newTotal,
        newCurrency,
        netCollected: net,
        collectedCurrency,
        amountDue: settlement.amountDue,
        amountRefund: settlement.amountRefund,
        cashPayableTotal: null,
      },
    };
  } finally {
    client.release();
  }
}

export async function finalizeReservationEdit(input?: {
  legalAccepted?: boolean;
}): Promise<EditFinalizeResult> {
  if (input?.legalAccepted !== true) {
    return { ok: false, reason: "legal_required" };
  }

  const browserSessionId = await readBrowserSessionId();
  if (!browserSessionId) {
    return { ok: false, reason: "unauthenticated-session" };
  }

  const preview = await buildEditFinalizeReview(browserSessionId);
  if (!preview.ok) {
    return { ok: false, reason: preview.reason };
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const draft = await findActiveDraftWithClient(client, browserSessionId);
    if (!draft?.editingOriginal || draft.id !== preview.draftId) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-found" };
    }

    const reservationId = preview.reservationId;
    const locked = await client.query<{
      id: string;
      reservation_code: string;
      payment_method: string | null;
      status: string;
    }>(
      `SELECT id, reservation_code, payment_method, status
       FROM reservations
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [reservationId],
    );
    const reservation = locked.rows[0];
    if (!reservation) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-found" };
    }

    const paymentMethod = (reservation.payment_method ?? "").trim().toLowerCase();
    const gatePayment =
      paymentMethod === ONLINE_PAYMENT_METHOD ? "sbp" : paymentMethod === "cash" ? "cash" : null;
    if (!gatePayment) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid", review: preview.review };
    }
    const primary = draft.passengers.find((item) => item.isPrimaryPassenger);
    const email = draft.customerEmail?.trim() ?? "";
    if (
      !checkoutCanComplete({
        emailValid: Boolean(email && isValidEmail(email)),
        phoneValid: Boolean(draft.customerPhone?.trim()),
        mainPassengerComplete: isPrimaryPassengerReady(primary),
        payment: gatePayment,
        legalAccepted: true,
        captchaVerified: true,
      })
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "checkout", review: preview.review };
    }

    const idempotencyKey = `edit-finalize:${draft.id}:${preview.review.mode}:${preview.review.newTotal}:${preview.review.newCurrency}`;

    const existingSettlement = await client.query<{
      id: string;
      status: string;
      payment_transaction_id: string | null;
    }>(
      `SELECT id, status, payment_transaction_id
       FROM reservation_edit_settlements
       WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    if (
      existingSettlement.rows[0]?.status === "committed" &&
      preview.review.mode !== "additional_payment"
    ) {
      await client.query("COMMIT");
      return {
        ok: true,
        outcome: "committed",
        reservationId,
        reservationCode: reservation.reservation_code,
        mode: preview.review.mode,
        review: preview.review,
      };
    }

    // ---- CASH: update total only, no ledger ----
    if (preview.review.mode === "cash_update") {
      await applyEditDraftToReservation(client, reservationId, draft);
      await auditOpsEditIfNeeded(client, draft, reservationId, "cash_update");
      await client.query(
        `INSERT INTO reservation_edit_settlements (
           reservation_id, edit_draft_id, mode, status, idempotency_key,
           old_total, old_currency, new_total, new_currency, difference,
           net_collected_before, committed_at
         ) VALUES (
           $1, $2, 'cash_update', 'committed', $3,
           $4, $5, $6, $7, $8,
           0, NOW()
         )
         ON CONFLICT (idempotency_key) DO UPDATE
           SET status = 'committed', committed_at = COALESCE(reservation_edit_settlements.committed_at, NOW())`,
        [
          reservationId,
          draft.id,
          idempotencyKey,
          draft.editingOriginal.totalPrice,
          draft.editingOriginal.currency,
          preview.review.newTotal,
          preview.review.newCurrency,
          0,
        ],
      );
      await client.query("COMMIT");
      return {
        ok: true,
        outcome: "committed",
        reservationId,
        reservationCode: reservation.reservation_code,
        mode: "cash_update",
        review: preview.review,
      };
    }

    // ---- ZERO DIFF ----
    if (preview.review.mode === "zero_diff") {
      await applyEditDraftToReservation(client, reservationId, draft);
      await auditOpsEditIfNeeded(client, draft, reservationId, "zero_diff");
      await client.query(
        `INSERT INTO reservation_edit_settlements (
           reservation_id, edit_draft_id, mode, status, idempotency_key,
           old_total, old_currency, new_total, new_currency, difference,
           net_collected_before, committed_at
         ) VALUES (
           $1, $2, 'zero_diff', 'committed', $3,
           $4, $5, $6, $7, 0,
           $8, NOW()
         )
         ON CONFLICT (idempotency_key) DO UPDATE
           SET status = 'committed', committed_at = COALESCE(reservation_edit_settlements.committed_at, NOW())`,
        [
          reservationId,
          draft.id,
          idempotencyKey,
          draft.editingOriginal.totalPrice,
          draft.editingOriginal.currency,
          preview.review.newTotal,
          preview.review.newCurrency,
          preview.review.netCollected,
        ],
      );
      await client.query("COMMIT");
      return {
        ok: true,
        outcome: "committed",
        reservationId,
        reservationCode: reservation.reservation_code,
        mode: "zero_diff",
        review: preview.review,
      };
    }

    // ---- REFUND: submit LIFO partial refund first; only then commit trip fields ----
    if (preview.review.mode === "refund") {
      if (!(preview.review.amountRefund > 0)) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "invalid", review: preview.review };
      }

      const batch = await createRefundBatchWithPlan(client, {
        reservationId,
        kind: "edit_settlement",
        requiredAmount: preview.review.amountRefund,
        currency: preview.review.collectedCurrency ?? preview.review.newCurrency,
        idempotencyKey: `${idempotencyKey}:refund-batch`,
        editDraftId: draft.id,
        reason: "edit_price_decrease",
        requestedByOpsUserId: draft.editingOriginal?.opsUserId ?? null,
      });
      if (!batch.ok) {
        await client.query("ROLLBACK");
        return {
          ok: false,
          reason: "insufficient-refundable",
          review: preview.review,
        };
      }

      const submitted = await submitRefundBatchAllocations(
        client,
        batch.batchId,
        `Edit settlement ${reservation.reservation_code}`,
      );
      if (!submitted.ok || submitted.failedAmount > 0) {
        // Keep refund ledger attempt for ops history; do not update reservation.
        await client.query("COMMIT");
        return {
          ok: false,
          reason: "provider",
          review: preview.review,
        };
      }

      await applyEditDraftToReservation(client, reservationId, draft);
      await auditOpsEditIfNeeded(client, draft, reservationId, "refund");

      await client.query(
        `INSERT INTO reservation_edit_settlements (
           reservation_id, edit_draft_id, mode, status, idempotency_key,
           old_total, old_currency, new_total, new_currency, difference,
           net_collected_before, refund_batch_id, committed_at
         ) VALUES (
           $1, $2, 'refund', 'committed', $3,
           $4, $5, $6, $7, $8,
           $9, $10, NOW()
         )
         ON CONFLICT (idempotency_key) DO UPDATE
           SET status = 'committed',
               refund_batch_id = COALESCE(
                 reservation_edit_settlements.refund_batch_id,
                 EXCLUDED.refund_batch_id
               ),
               committed_at = COALESCE(
                 reservation_edit_settlements.committed_at,
                 NOW()
               )`,
        [
          reservationId,
          draft.id,
          idempotencyKey,
          draft.editingOriginal.totalPrice,
          draft.editingOriginal.currency,
          preview.review.newTotal,
          preview.review.newCurrency,
          money(-preview.review.amountRefund),
          preview.review.netCollected,
          batch.batchId,
        ],
      );

      await client.query(
        `UPDATE reservation_refund_batches
         SET edit_settlement_id = (
           SELECT id FROM reservation_edit_settlements WHERE idempotency_key = $2
         )
         WHERE id = $1
           AND edit_settlement_id IS NULL`,
        [batch.batchId, idempotencyKey],
      );

      await client.query("COMMIT");
      return {
        ok: true,
        outcome: "committed",
        reservationId,
        reservationCode: reservation.reservation_code,
        mode: "refund",
        review: preview.review,
      };
    }

    // ---- ADDITIONAL PAYMENT: commit reservation now; payment settles later ----
    const payCurrency = normalizePaymentCurrency(preview.review.newCurrency);
    if (!isSbpAllowedCurrency(payCurrency)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid", review: preview.review };
    }

    // Same trip commit point as cash: user confirmed the edit by clicking CTA.
    await applyEditDraftToReservation(client, reservationId, draft);
    await auditOpsEditIfNeeded(
      client,
      draft,
      reservationId,
      "additional_payment",
    );

    let settlementId = existingSettlement.rows[0]?.id ?? null;
    if (!settlementId) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO reservation_edit_settlements (
           reservation_id, edit_draft_id, mode, status, idempotency_key,
           old_total, old_currency, new_total, new_currency, difference,
           net_collected_before, committed_at
         ) VALUES (
           $1, $2, 'additional_payment', 'committed', $3,
           $4, $5, $6, $7, $8,
           $9, NOW()
         )
         RETURNING id`,
        [
          reservationId,
          draft.id,
          idempotencyKey,
          draft.editingOriginal.totalPrice,
          draft.editingOriginal.currency,
          preview.review.newTotal,
          payCurrency,
          preview.review.amountDue,
          preview.review.netCollected,
        ],
      );
      settlementId = inserted.rows[0]!.id;
    } else if (existingSettlement.rows[0]?.status !== "committed") {
      await client.query(
        `UPDATE reservation_edit_settlements
         SET status = 'committed',
             committed_at = COALESCE(committed_at, NOW()),
             new_total = $2,
             new_currency = $3,
             difference = $4,
             net_collected_before = $5
         WHERE id = $1`,
        [
          settlementId,
          preview.review.newTotal,
          payCurrency,
          preview.review.amountDue,
          preview.review.netCollected,
        ],
      );
    }

    const sequenceNo = await nextPaymentSequence(client, reservationId);
    const paymentInsert = await insertPaymentTransaction(client, {
      reservationId,
      reservationCode: reservation.reservation_code,
      sequenceNo,
      kind: "additional_payment",
      amount: preview.review.amountDue,
      currency: payCurrency,
      status: "pending",
      idempotencyKey: `${idempotencyKey}:payment`,
      editDraftId: draft.id,
      editSettlementId: settlementId,
    });

    const existingPayment = await client.query<{
      id: string;
      provider_order_id: string | null;
      provider_payment_url: string | null;
    }>(
      `SELECT id, provider_order_id, provider_payment_url
       FROM reservation_payment_transactions
       WHERE id = $1
       FOR UPDATE`,
      [paymentInsert.id],
    );
    let idOrder = existingPayment.rows[0]?.provider_order_id ?? null;
    let paymentUrl = existingPayment.rows[0]?.provider_payment_url ?? null;

    await client.query(
      `UPDATE reservation_edit_settlements
       SET payment_transaction_id = $2
       WHERE id = $1`,
      [settlementId, paymentInsert.id],
    );

    await syncReservationPaymentSummary(client, reservationId);

    // Commit reservation + ledger before Turinvoice HTTP.
    await client.query("COMMIT");

    if (!idOrder || !paymentUrl) {
      const locale = (draft.locale ?? "tr").trim() || "tr";
      const orderResult = await ensureTurinvoiceOrderForPaymentTransaction({
        paymentTransactionId: paymentInsert.id,
        amount: preview.review.amountDue,
        currency: payCurrency,
        orderName: `${reservation.reservation_code} additional`,
        locale,
      });
      if (!orderResult.ok) {
        console.error("[edit-finalize] additional payment order failed", {
          reservationId,
          paymentTransactionId: paymentInsert.id,
          amountDue: preview.review.amountDue,
          currency: payCurrency,
          reason: orderResult.reason,
        });
        // Reservation edit is already committed; payment can be retried/managed later.
        return { ok: false, reason: "provider", review: preview.review };
      }
      idOrder = orderResult.idOrder;
      paymentUrl = orderResult.paymentUrl;
      const syncClient = await getPool().connect();
      try {
        await syncReservationPaymentSummary(syncClient, reservationId);
      } finally {
        syncClient.release();
      }
    }

    if (!paymentUrl || !idOrder) {
      return { ok: false, reason: "provider", review: preview.review };
    }

    return {
      ok: true,
      outcome: "payment_required",
      reservationId,
      reservationCode: reservation.reservation_code,
      paymentUrl,
      amountDue: preview.review.amountDue,
      currency: payCurrency,
      review: { ...preview.review, newCurrency: payCurrency },
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[edit-finalize] failed", error);
    return { ok: false, reason: "failed" };
  } finally {
    client.release();
  }
}

/** After additional payment is marked paid: financial settlement only.
 * Trip fields were already committed when the customer clicked Ödemeye Geç.
 */
export async function commitPendingEditAfterAdditionalPayment(
  client: import("pg").PoolClient,
  input: {
    reservationId: string;
    paymentTransactionId: string;
    editDraftId: string | null;
    editSettlementId: string | null;
  },
) {
  if (input.editSettlementId) {
    await client.query(
      `UPDATE reservation_edit_settlements
       SET status = 'committed',
           committed_at = COALESCE(committed_at, NOW()),
           payment_transaction_id = COALESCE(payment_transaction_id, $2)
       WHERE id = $1`,
      [input.editSettlementId, input.paymentTransactionId],
    );
  }

  await syncReservationPaymentSummary(client, input.reservationId);
  return { committed: true as const, already: true as const };
}
