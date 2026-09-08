import "server-only";

import { type PoolClient } from "pg";
import { query } from "@/lib/db/postgres";
import {
  PAYMENT_TXN_CANCELLED,
  PAYMENT_TXN_PAID,
  PAYMENT_TXN_PENDING,
  type LedgerPayment,
  type LedgerRefundAllocation,
  type PaymentTxnStatus,
  paymentInternalReference,
  summarizeReservationFinances,
  type FinancialSummary,
} from "@/lib/payments/ledger/math";
import { ONLINE_PAYMENT_PROVIDER } from "@/lib/payments/online-payment";

type PaymentRow = {
  id: string;
  reservation_id: string;
  sequence_no: number;
  internal_reference: string;
  kind: "initial_payment" | "additional_payment";
  provider: string;
  provider_order_id: string | null;
  provider_payment_url: string | null;
  amount: string;
  currency: string;
  status: string;
  created_at: Date;
  paid_at: Date | null;
  edit_draft_id: string | null;
  edit_settlement_id: string | null;
};

type RefundRow = {
  id: string;
  payment_transaction_id: string;
  amount: string;
  currency: string;
  status: string;
};

function asMoney(value: string | number | null | undefined) {
  if (value == null || value === "") {
    return 0;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function mapPayment(row: PaymentRow): LedgerPayment {
  return {
    id: row.id,
    sequenceNo: row.sequence_no,
    internalReference: row.internal_reference,
    kind: row.kind,
    providerOrderId: row.provider_order_id,
    amount: asMoney(row.amount),
    currency: row.currency,
    status: row.status as PaymentTxnStatus,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
  };
}

export async function listPaymentTransactions(
  reservationId: string,
  client?: PoolClient,
): Promise<LedgerPayment[]> {
  const sql = `SELECT id, reservation_id, sequence_no, internal_reference, kind,
            provider, provider_order_id, provider_payment_url, amount::text,
            currency, status, created_at, paid_at, edit_draft_id, edit_settlement_id
     FROM reservation_payment_transactions
     WHERE reservation_id = $1
     ORDER BY sequence_no ASC`;
  const result = client
    ? await client.query<PaymentRow>(sql, [reservationId])
    : await query<PaymentRow>(sql, [reservationId]);
  return result.rows.map(mapPayment);
}

export async function listRefundAllocations(
  reservationId: string,
  client?: PoolClient,
): Promise<LedgerRefundAllocation[]> {
  const sql = `SELECT id, payment_transaction_id, amount::text, currency, status
     FROM reservation_refund_allocations
     WHERE reservation_id = $1
     ORDER BY created_at ASC`;
  const result = client
    ? await client.query<RefundRow>(sql, [reservationId])
    : await query<RefundRow>(sql, [reservationId]);
  return result.rows.map((row) => ({
    id: row.id,
    paymentTransactionId: row.payment_transaction_id,
    amount: asMoney(row.amount),
    currency: row.currency,
    status: row.status as LedgerRefundAllocation["status"],
  }));
}

export async function loadReservationFinancialSummary(input: {
  reservationId: string;
  currentTotal: number | null;
  currentCurrency: string | null;
  client?: PoolClient;
}): Promise<FinancialSummary> {
  const [payments, refunds] = await Promise.all([
    listPaymentTransactions(input.reservationId, input.client),
    listRefundAllocations(input.reservationId, input.client),
  ]);
  return summarizeReservationFinances({
    payments,
    refunds,
    currentReservationTotal: input.currentTotal,
    currentCurrency: input.currentCurrency,
  });
}

export async function nextPaymentSequence(
  client: PoolClient,
  reservationId: string,
) {
  const result = await client.query<{ max: number | null }>(
    `SELECT MAX(sequence_no)::int AS max
     FROM reservation_payment_transactions
     WHERE reservation_id = $1`,
    [reservationId],
  );
  return (result.rows[0]?.max ?? 0) + 1;
}

export async function insertPaymentTransaction(
  client: PoolClient,
  input: {
    reservationId: string;
    reservationCode: string;
    sequenceNo: number;
    kind: "initial_payment" | "additional_payment";
    amount: number;
    currency: string;
    status: PaymentTxnStatus;
    idempotencyKey: string;
    providerOrderId?: string | null;
    providerPaymentUrl?: string | null;
    editDraftId?: string | null;
    editSettlementId?: string | null;
    paidAt?: Date | null;
    providerResponse?: unknown;
  },
) {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM reservation_payment_transactions WHERE idempotency_key = $1`,
    [input.idempotencyKey],
  );
  if (existing.rows[0]) {
    return { id: existing.rows[0].id, reused: true as const };
  }

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO reservation_payment_transactions (
       reservation_id, sequence_no, internal_reference, kind, provider,
       provider_order_id, provider_payment_url, amount, currency, status,
       idempotency_key, edit_draft_id, edit_settlement_id, provider_response, paid_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, $13, $14::jsonb, $15
     )
     RETURNING id`,
    [
      input.reservationId,
      input.sequenceNo,
      paymentInternalReference(input.reservationCode, input.sequenceNo),
      input.kind,
      ONLINE_PAYMENT_PROVIDER,
      input.providerOrderId ?? null,
      input.providerPaymentUrl ?? null,
      input.amount,
      input.currency,
      input.status,
      input.idempotencyKey,
      input.editDraftId ?? null,
      input.editSettlementId ?? null,
      input.providerResponse ? JSON.stringify(input.providerResponse) : null,
      input.paidAt ?? null,
    ],
  );
  return { id: inserted.rows[0]!.id, reused: false as const };
}

export async function findPaymentTransactionByOrderId(
  client: PoolClient,
  providerOrderId: string,
) {
  const result = await client.query<PaymentRow>(
    `SELECT id, reservation_id, sequence_no, internal_reference, kind,
            provider, provider_order_id, provider_payment_url, amount::text,
            currency, status, created_at, paid_at, edit_draft_id, edit_settlement_id
     FROM reservation_payment_transactions
     WHERE provider_order_id = $1
     LIMIT 1
     FOR UPDATE`,
    [providerOrderId],
  );
  return result.rows[0] ?? null;
}

export async function markPaymentTransactionPaid(
  client: PoolClient,
  paymentId: string,
  paidAt: Date | null,
) {
  await client.query(
    `UPDATE reservation_payment_transactions
     SET status = $2,
         paid_at = COALESCE($3, paid_at, NOW())
     WHERE id = $1
       AND status = $4`,
    [paymentId, PAYMENT_TXN_PAID, paidAt, PAYMENT_TXN_PENDING],
  );
}

export async function markPaymentTransactionCancelled(
  client: PoolClient,
  paymentId: string,
) {
  const result = await client.query<{ id: string }>(
    `UPDATE reservation_payment_transactions
     SET status = $2
     WHERE id = $1
       AND status = $3
     RETURNING id`,
    [paymentId, PAYMENT_TXN_CANCELLED, PAYMENT_TXN_PENDING],
  );
  return Boolean(result.rows[0]);
}

/** Sync denormalized reservation payment summary from ledger. */
export async function syncReservationPaymentSummary(
  client: PoolClient,
  reservationId: string,
) {
  const meta = await client.query<{
    payment_method: string | null;
    total_price: string | null;
    currency: string | null;
  }>(
    `SELECT payment_method, total_price::text, currency
     FROM reservations
     WHERE id = $1
     FOR UPDATE`,
    [reservationId],
  );
  const reservation = meta.rows[0];
  if (!reservation) {
    return;
  }
  if ((reservation.payment_method ?? "").trim().toLowerCase() !== "sbp") {
    return;
  }

  const payments = await listPaymentTransactions(reservationId, client);
  const refunds = await listRefundAllocations(reservationId, client);
  const paid = payments.filter((p) => p.status === PAYMENT_TXN_PAID);
  const pending = [...payments]
    .filter((p) => p.status === PAYMENT_TXN_PENDING)
    .sort((a, b) => b.sequenceNo - a.sequenceNo)[0];
  const latestPaid = [...paid].sort((a, b) => b.sequenceNo - a.sequenceNo)[0];
  const totalRaw =
    reservation.total_price == null || reservation.total_price === ""
      ? null
      : Number(reservation.total_price);
  const currentTotal =
    totalRaw != null && Number.isFinite(totalRaw) ? totalRaw : null;
  const summary = summarizeReservationFinances({
    payments,
    refunds,
    currentReservationTotal: currentTotal,
    currentCurrency:
      reservation.currency?.trim().toUpperCase() ||
      latestPaid?.currency ||
      pending?.currency ||
      null,
  });
  const remaining =
    summary.differenceFromTotal == null
      ? null
      : Math.max(0, summary.differenceFromTotal);
  const fullySettled =
    paid.length > 0 && remaining != null && remaining <= 0.005;
  const awaitingPayment =
    Boolean(pending) || (remaining != null && remaining > 0.005);

  let pendingUrl: string | null = null;
  if (pending) {
    const urlRow = await client.query<{ provider_payment_url: string | null }>(
      `SELECT provider_payment_url FROM reservation_payment_transactions WHERE id = $1`,
      [pending.id],
    );
    pendingUrl = urlRow.rows[0]?.provider_payment_url ?? null;
  }

  const focusOrderId =
    pending?.providerOrderId ?? latestPaid?.providerOrderId ?? null;

  await client.query(
    `UPDATE reservations
     SET payment_status = CASE
           WHEN $2::boolean THEN 'paid'
           WHEN $3::boolean THEN 'pending'
           ELSE payment_status
         END,
         payment_provider = CASE
           WHEN $2::boolean OR $3::boolean THEN 'turinvoice'
           ELSE payment_provider
         END,
         payment_provider_order_id = COALESCE($4, payment_provider_order_id),
         payment_provider_payment_url = CASE
           WHEN $3::boolean THEN $5
           ELSE payment_provider_payment_url
         END,
         payment_amount = CASE
           WHEN $6::numeric IS NOT NULL THEN $6
           ELSE payment_amount
         END,
         payment_currency = COALESCE($7, payment_currency),
         paid_at = COALESCE(paid_at, $8::timestamptz),
         refund_amount = CASE
           WHEN ($9::numeric > 0 OR $10::numeric > 0)
             THEN GREATEST($9::numeric, $10::numeric)
           ELSE refund_amount
         END,
         refund_currency = CASE
           WHEN ($9::numeric > 0 OR $10::numeric > 0) THEN $7
           ELSE refund_currency
         END,
         refund_status = CASE
           WHEN $10::numeric > 0 THEN 'submitted'
           WHEN $9::numeric > 0 THEN COALESCE(refund_status, 'completed')
           ELSE refund_status
         END
     WHERE id = $1`,
    [
      reservationId,
      fullySettled,
      awaitingPayment && !fullySettled,
      focusOrderId,
      pendingUrl,
      summary.grossSuccessfulPayments > 0
        ? summary.grossSuccessfulPayments
        : null,
      summary.currency,
      paid[0]?.paidAt ? new Date(paid[0].paidAt) : null,
      summary.completedRefunds,
      summary.pendingRefunds,
    ],
  );
}

export type PaymentHistoryItem = {
  sequenceNo: number;
  internalReference: string;
  kind: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  providerOrderId: string | null;
  refundableBalance: number;
  createdAt: string | null;
  paidAt: string | null;
};

export async function listPaymentHistoryForOps(reservationId: string) {
  const { refundableBalanceForPayment } = await import(
    "@/lib/payments/ledger/math"
  );
  const payments = await listPaymentTransactions(reservationId);
  const refunds = await listRefundAllocations(reservationId);
  return payments.map((payment) => {
    const related = refunds.filter((r) => r.paymentTransactionId === payment.id);
    return {
      sequenceNo: payment.sequenceNo,
      internalReference: payment.internalReference,
      kind: payment.kind,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      provider: ONLINE_PAYMENT_PROVIDER,
      providerOrderId: payment.providerOrderId,
      refundableBalance: refundableBalanceForPayment(payment, related),
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
    } satisfies PaymentHistoryItem;
  });
}
