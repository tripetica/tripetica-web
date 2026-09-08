import "server-only";

import { type PoolClient } from "pg";
import {
  planLifoRefundAllocation,
  REFUND_ALLOC_FAILED,
  REFUND_ALLOC_SUBMITTED,
  REFUND_BATCH_FAILED,
  REFUND_BATCH_PARTIAL,
  REFUND_BATCH_SUBMITTED,
  refundableBalanceForPayment,
  refundBatchStatusFromAllocations,
  type LifoAllocationItem,
} from "@/lib/payments/ledger/math";
import {
  listPaymentTransactions,
  listRefundAllocations,
  syncReservationPaymentSummary,
} from "@/lib/payments/ledger/store";
import { createTurinvoiceRefund } from "@/lib/payments/turinvoice/client";
import { requireTurinvoiceConfig } from "@/lib/payments/turinvoice/config";
import { ONLINE_PAYMENT_PROVIDER } from "@/lib/payments/online-payment";

export type SubmitLifoRefundResult =
  | {
      ok: true;
      batchId: string;
      status: string;
      submittedAmount: number;
      failedAmount: number;
      allocations: Array<{
        paymentTransactionId: string;
        amount: number;
        status: string;
        providerOrderId: string;
        providerRefundId: string | null;
      }>;
    }
  | { ok: false; reason: "insufficient-balance" | "provider" | "failed"; batchId?: string };

function money(value: number) {
  return Number(value.toFixed(2));
}

export async function createRefundBatchWithPlan(
  client: PoolClient,
  input: {
    reservationId: string;
    kind: "edit_settlement" | "cancel_full" | "ops_manual";
    requiredAmount: number;
    currency: string;
    idempotencyKey: string;
    editDraftId?: string | null;
    editSettlementId?: string | null;
    reason?: string | null;
    adminOverride?: boolean;
    requestedByOpsUserId?: string | null;
    requestedByCustomerUserId?: string | null;
  },
): Promise<
  | { ok: true; batchId: string; plan: LifoAllocationItem[]; reused: boolean }
  | { ok: false; reason: "insufficient-balance" }
> {
  const existing = await client.query<{ id: string; status: string }>(
    `SELECT id, status FROM reservation_refund_batches WHERE idempotency_key = $1`,
    [input.idempotencyKey],
  );
  if (existing.rows[0]) {
    const allocs = await client.query<{
      payment_transaction_id: string;
      amount: string;
      currency: string;
      provider_order_id: string;
      sequence_no: number;
    }>(
      `SELECT a.payment_transaction_id, a.amount::text, a.currency, a.provider_order_id,
              t.sequence_no
       FROM reservation_refund_allocations a
       INNER JOIN reservation_payment_transactions t ON t.id = a.payment_transaction_id
       WHERE a.batch_id = $1
       ORDER BY a.sequence_no ASC`,
      [existing.rows[0].id],
    );
    return {
      ok: true,
      batchId: existing.rows[0].id,
      reused: true,
      plan: allocs.rows.map((row) => ({
        paymentTransactionId: row.payment_transaction_id,
        sequenceNo: row.sequence_no,
        providerOrderId: row.provider_order_id,
        amount: Number(row.amount),
        currency: row.currency,
        internalReference: "",
      })),
    };
  }

  const payments = await listPaymentTransactions(input.reservationId, client);
  const refunds = await listRefundAllocations(input.reservationId, client);
  const plan = planLifoRefundAllocation({
    requiredAmount: input.requiredAmount,
    currency: input.currency,
    payments,
    refunds,
  });
  if (!plan) {
    return { ok: false, reason: "insufficient-balance" };
  }

  const batch = await client.query<{ id: string }>(
    `INSERT INTO reservation_refund_batches (
       reservation_id, kind, required_amount, currency, status, idempotency_key,
       edit_draft_id, edit_settlement_id, reason, admin_override,
       requested_by_ops_user_id, requested_by_customer_user_id
     ) VALUES (
       $1, $2, $3, $4, 'planned', $5,
       $6, $7, $8, $9,
       $10, $11
     )
     RETURNING id`,
    [
      input.reservationId,
      input.kind,
      input.requiredAmount,
      input.currency,
      input.idempotencyKey,
      input.editDraftId ?? null,
      input.editSettlementId ?? null,
      input.reason ?? null,
      input.adminOverride === true,
      input.requestedByOpsUserId ?? null,
      input.requestedByCustomerUserId ?? null,
    ],
  );
  const batchId = batch.rows[0]!.id;

  let seq = 1;
  for (const item of plan) {
    await client.query(
      `INSERT INTO reservation_refund_allocations (
         batch_id, reservation_id, payment_transaction_id, sequence_no,
         provider, provider_order_id, amount, currency, status, idempotency_key
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8, 'planned', $9
       )`,
      [
        batchId,
        input.reservationId,
        item.paymentTransactionId,
        seq,
        ONLINE_PAYMENT_PROVIDER,
        item.providerOrderId,
        item.amount,
        item.currency,
        `${input.idempotencyKey}:alloc:${seq}`,
      ],
    );
    seq += 1;
  }

  return { ok: true, batchId, plan, reused: false };
}

/**
 * Submit planned allocations to Turinvoice. Never re-sends submitted/completed rows.
 */
export async function submitRefundBatchAllocations(
  client: PoolClient,
  batchId: string,
  description?: string,
): Promise<SubmitLifoRefundResult> {
  const batch = await client.query<{
    id: string;
    reservation_id: string;
    required_amount: string;
    currency: string;
  }>(
    `SELECT id, reservation_id, required_amount::text, currency
     FROM reservation_refund_batches
     WHERE id = $1
     FOR UPDATE`,
    [batchId],
  );
  const row = batch.rows[0];
  if (!row) {
    return { ok: false, reason: "failed" };
  }

  const allocs = await client.query<{
    id: string;
    payment_transaction_id: string;
    amount: string;
    currency: string;
    status: string;
    provider_order_id: string;
    provider_refund_id: string | null;
    idempotency_key: string;
  }>(
    `SELECT id, payment_transaction_id, amount::text, currency, status,
            provider_order_id, provider_refund_id, idempotency_key
     FROM reservation_refund_allocations
     WHERE batch_id = $1
     ORDER BY sequence_no ASC
     FOR UPDATE`,
    [batchId],
  );

  requireTurinvoiceConfig();
  let submittedAmount = 0;
  let failedAmount = 0;
  const results: Array<{
    paymentTransactionId: string;
    amount: number;
    status: string;
    providerOrderId: string;
    providerRefundId: string | null;
  }> = [];

  for (const alloc of allocs.rows) {
    if (alloc.status === "submitted" || alloc.status === "completed") {
      submittedAmount = money(submittedAmount + Number(alloc.amount));
      results.push({
        paymentTransactionId: alloc.payment_transaction_id,
        amount: Number(alloc.amount),
        status: alloc.status,
        providerOrderId: alloc.provider_order_id,
        providerRefundId: alloc.provider_refund_id,
      });
      continue;
    }
    if (alloc.status === "failed") {
      failedAmount = money(failedAmount + Number(alloc.amount));
      results.push({
        paymentTransactionId: alloc.payment_transaction_id,
        amount: Number(alloc.amount),
        status: alloc.status,
        providerOrderId: alloc.provider_order_id,
        providerRefundId: null,
      });
      continue;
    }

    try {
      const refund = await createTurinvoiceRefund({
        idOrder: alloc.provider_order_id,
        amount: Number(alloc.amount),
        currency: alloc.currency,
        description,
      });
      await client.query(
        `UPDATE reservation_refund_allocations
         SET status = $2,
             provider_refund_id = $3,
             provider_response = $4::jsonb,
             provider_error = NULL,
             requested_at = NOW()
         WHERE id = $1`,
        [
          alloc.id,
          REFUND_ALLOC_SUBMITTED,
          refund.idRefund,
          JSON.stringify(refund.raw),
        ],
      );
      submittedAmount = money(submittedAmount + Number(alloc.amount));
      results.push({
        paymentTransactionId: alloc.payment_transaction_id,
        amount: Number(alloc.amount),
        status: REFUND_ALLOC_SUBMITTED,
        providerOrderId: alloc.provider_order_id,
        providerRefundId: refund.idRefund,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 1000) : "refund failed";
      await client.query(
        `UPDATE reservation_refund_allocations
         SET status = $2,
             provider_error = $3,
             requested_at = NOW()
         WHERE id = $1`,
        [alloc.id, REFUND_ALLOC_FAILED, message],
      );
      failedAmount = money(failedAmount + Number(alloc.amount));
      results.push({
        paymentTransactionId: alloc.payment_transaction_id,
        amount: Number(alloc.amount),
        status: REFUND_ALLOC_FAILED,
        providerOrderId: alloc.provider_order_id,
        providerRefundId: null,
      });
    }
  }

  const batchStatus = refundBatchStatusFromAllocations(
    results.map((item) => ({
      status: item.status as "submitted" | "completed" | "failed" | "planned",
    })),
  );
  await client.query(
    `UPDATE reservation_refund_batches
     SET status = $2,
         submitted_at = COALESCE(submitted_at, NOW())
     WHERE id = $1`,
    [batchId, batchStatus],
  );

  // Denormalized reservation refund summary (latest batch).
  await client.query(
    `UPDATE reservations
     SET refund_provider = $2,
         refund_amount = $3,
         refund_currency = $4,
         refund_status = $5,
         refund_requested_at = COALESCE(refund_requested_at, NOW()),
         refund_provider_order_id = $6,
         refund_provider_refund_id = $7
     WHERE id = $1`,
    [
      row.reservation_id,
      ONLINE_PAYMENT_PROVIDER,
      Number(row.required_amount),
      row.currency,
      batchStatus === REFUND_BATCH_FAILED
        ? "failed"
        : batchStatus === REFUND_BATCH_PARTIAL
          ? "submitted"
          : "submitted",
      results[0]?.providerOrderId ?? null,
      results.find((r) => r.providerRefundId)?.providerRefundId ?? null,
    ],
  );

  await syncReservationPaymentSummary(client, row.reservation_id);

  if (failedAmount > 0 && submittedAmount === 0) {
    return {
      ok: false,
      reason: "provider",
      batchId,
    };
  }

  return {
    ok: true,
    batchId,
    status: batchStatus,
    submittedAmount,
    failedAmount,
    allocations: results,
  };
}

/**
 * Create + submit a refund for a single paid payment transaction (ops payment history).
 * Amount must be > 0 and <= remaining refundable balance on that txn.
 */
export async function createAndSubmitPaymentTransactionRefund(
  client: PoolClient,
  input: {
    reservationId: string;
    paymentTransactionId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
    opsUserId: string;
    description?: string;
  },
): Promise<SubmitLifoRefundResult> {
  const amount = money(input.amount);
  if (!(amount > 0)) {
    return { ok: false, reason: "failed" };
  }

  const payment = await client.query<{
    id: string;
    reservation_id: string;
    amount: string;
    currency: string;
    status: string;
    provider_order_id: string | null;
    sequence_no: number;
    internal_reference: string;
  }>(
    `SELECT id, reservation_id, amount::text, currency, status,
            provider_order_id, sequence_no, internal_reference
     FROM reservation_payment_transactions
     WHERE id = $1
     FOR UPDATE`,
    [input.paymentTransactionId],
  );
  const row = payment.rows[0];
  if (!row || row.reservation_id !== input.reservationId) {
    return { ok: false, reason: "failed" };
  }
  if ((row.status ?? "").trim().toLowerCase() !== "paid") {
    return { ok: false, reason: "failed" };
  }
  if (!row.provider_order_id?.trim()) {
    return { ok: false, reason: "failed" };
  }
  const currency = row.currency.trim().toUpperCase();
  if (currency !== input.currency.trim().toUpperCase()) {
    return { ok: false, reason: "failed" };
  }

  const existing = await client.query<{ id: string }>(
    `SELECT id FROM reservation_refund_batches WHERE idempotency_key = $1`,
    [input.idempotencyKey],
  );
  let batchId = existing.rows[0]?.id ?? null;
  if (!batchId) {
    const refunds = await listRefundAllocations(input.reservationId, client);
    const related = refunds.filter(
      (item) => item.paymentTransactionId === row.id,
    );
    const balance = refundableBalanceForPayment(
      {
        amount: Number(row.amount),
        status: "paid",
        currency,
      },
      related,
    );
    if (amount > balance) {
      return { ok: false, reason: "insufficient-balance" };
    }

    const batch = await client.query<{ id: string }>(
      `INSERT INTO reservation_refund_batches (
         reservation_id, kind, required_amount, currency, status, idempotency_key,
         reason, admin_override, requested_by_ops_user_id
       ) VALUES (
         $1, 'ops_manual', $2, $3, 'planned', $4,
         $5, false, $6
       )
       RETURNING id`,
      [
        input.reservationId,
        amount,
        currency,
        input.idempotencyKey,
        "ops_payment_history_refund",
        input.opsUserId,
      ],
    );
    batchId = batch.rows[0]!.id;
    await client.query(
      `INSERT INTO reservation_refund_allocations (
         batch_id, reservation_id, payment_transaction_id, sequence_no,
         provider, provider_order_id, amount, currency, status, idempotency_key
       ) VALUES (
         $1, $2, $3, 1,
         $4, $5, $6, $7, 'planned', $8
       )`,
      [
        batchId,
        input.reservationId,
        row.id,
        ONLINE_PAYMENT_PROVIDER,
        row.provider_order_id,
        amount,
        currency,
        `${input.idempotencyKey}:alloc:1`,
      ],
    );
  }

  return submitRefundBatchAllocations(
    client,
    batchId,
    input.description ?? `Ops payment refund ${row.provider_order_id}`,
  );
}
