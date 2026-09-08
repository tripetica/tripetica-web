import { type OpsCopy } from "@/lib/ops/copy";
import { formatOpsDateTime } from "@/lib/ops/format";
import { formatOpsAmountOrDash } from "@/lib/ops/money";
import { type Locale } from "@/lib/i18n/config";
import {
  PAYMENT_TXN_CANCELLED,
  PAYMENT_TXN_EXPIRED,
  PAYMENT_TXN_PAID,
  PAYMENT_TXN_PENDING,
  REFUND_ALLOC_COMPLETED,
  REFUND_ALLOC_SUBMITTED,
  type LedgerPayment,
  type LedgerRefundAllocation,
  type FinancialSummary,
  refundableBalanceForPayment,
} from "@/lib/payments/ledger/math";

/**
 * Turinvoice supports unpaid order cancel via DELETE /api/v1/tsp/order?idOrder=…
 * Local cancelled status is applied only after a successful provider response.
 */
export const TURINVOICE_PENDING_ORDER_CANCEL_SUPPORTED = true;

export type OpsPaymentMovementDisplayStatus =
  | "pending"
  | "paid"
  | "cancelled"
  | "failed"
  | "partially_refunded"
  | "refunded";

export type OpsPaymentHistoryAction =
  | "cancel_order"
  | "cancel_order_unsupported"
  | "refund"
  | "none";

export type OpsPaymentHistoryRow = {
  paymentTransactionId: string;
  createdAt: string | null;
  providerOrderId: string | null;
  amount: number;
  currency: string;
  rawStatus: string;
  displayStatus: OpsPaymentMovementDisplayStatus;
  collectedAmount: number;
  completedRefundedAmount: number;
  pendingRefundedAmount: number;
  refundableAmount: number;
  action: OpsPaymentHistoryAction;
};

export type OpsPaymentHistorySummary = {
  reservationTotal: number | null;
  grossSuccessful: number;
  completedRefunds: number;
  netCollected: number;
  remainingDue: number | null;
  currency: string | null;
};

export type OpsPaymentHistorySection = {
  summary: OpsPaymentHistorySummary;
  rows: OpsPaymentHistoryRow[];
};

export type OpsPaymentMovementCompactLine = {
  providerOrderId: string | null;
  amount: number;
  currency: string;
  displayStatus: OpsPaymentMovementDisplayStatus;
};

function money(value: number) {
  return Number(value.toFixed(2));
}

export function paymentMovementDisplayStatus(
  payment: Pick<LedgerPayment, "amount" | "status">,
  refundableAmount: number,
  completedRefundedAmount: number,
): OpsPaymentMovementDisplayStatus {
  const status = (payment.status ?? "").trim().toLowerCase();
  if (status === PAYMENT_TXN_PENDING) {
    return "pending";
  }
  if (status === PAYMENT_TXN_CANCELLED) {
    return "cancelled";
  }
  if (status === PAYMENT_TXN_EXPIRED) {
    return "failed";
  }
  if (status !== PAYMENT_TXN_PAID) {
    return "failed";
  }
  if (completedRefundedAmount > 0 && refundableAmount <= 0) {
    return "refunded";
  }
  if (completedRefundedAmount > 0 && refundableAmount < payment.amount) {
    return "partially_refunded";
  }
  return "paid";
}

export function paymentMovementAction(
  displayStatus: OpsPaymentMovementDisplayStatus,
  refundableAmount: number,
): OpsPaymentHistoryAction {
  if (displayStatus === "pending") {
    return TURINVOICE_PENDING_ORDER_CANCEL_SUPPORTED
      ? "cancel_order"
      : "cancel_order_unsupported";
  }
  if (
    (displayStatus === "paid" || displayStatus === "partially_refunded") &&
    refundableAmount > 0
  ) {
    return "refund";
  }
  return "none";
}

export function buildOpsPaymentHistorySection(input: {
  payments: LedgerPayment[];
  refunds: LedgerRefundAllocation[];
  summary: FinancialSummary;
}): OpsPaymentHistorySection {
  const rows = input.payments.map((payment) => {
    const related = input.refunds.filter(
      (refund) => refund.paymentTransactionId === payment.id,
    );
    let completed = 0;
    let pending = 0;
    for (const refund of related) {
      if (refund.status === REFUND_ALLOC_COMPLETED) {
        completed += refund.amount;
      } else if (refund.status === REFUND_ALLOC_SUBMITTED) {
        pending += refund.amount;
      }
    }
    completed = money(completed);
    pending = money(pending);
    const refundable = refundableBalanceForPayment(payment, related);
    const displayStatus = paymentMovementDisplayStatus(
      payment,
      refundable,
      completed,
    );
    return {
      paymentTransactionId: payment.id,
      createdAt: payment.createdAt,
      providerOrderId: payment.providerOrderId,
      amount: payment.amount,
      currency: payment.currency,
      rawStatus: payment.status,
      displayStatus,
      collectedAmount: payment.status === PAYMENT_TXN_PAID ? payment.amount : 0,
      completedRefundedAmount: completed,
      pendingRefundedAmount: pending,
      refundableAmount: refundable,
      action: paymentMovementAction(displayStatus, refundable),
    } satisfies OpsPaymentHistoryRow;
  });

  const remaining =
    input.summary.differenceFromTotal == null
      ? null
      : money(Math.max(0, input.summary.differenceFromTotal));

  return {
    summary: {
      reservationTotal: input.summary.currentReservationTotal,
      grossSuccessful: input.summary.grossSuccessfulPayments,
      completedRefunds: input.summary.completedRefunds,
      netCollected: input.summary.netCollectedAmount,
      remainingDue: remaining,
      currency: input.summary.currency,
    },
    rows,
  };
}

export function paymentMovementStatusLabel(
  status: OpsPaymentMovementDisplayStatus,
  copy: OpsCopy,
) {
  switch (status) {
    case "pending":
      return copy.paymentMovementPending;
    case "paid":
      return copy.paymentMovementPaid;
    case "cancelled":
      return copy.paymentMovementCancelled;
    case "failed":
      return copy.paymentMovementFailed;
    case "partially_refunded":
      return copy.paymentMovementPartialRefund;
    case "refunded":
      return copy.paymentMovementRefunded;
    default:
      return copy.paymentMovementFailed;
  }
}

export function paymentMovementStatusShortLabel(
  status: OpsPaymentMovementDisplayStatus,
  copy: OpsCopy,
) {
  switch (status) {
    case "pending":
      return copy.paymentMovementPendingShort;
    case "paid":
      return copy.paymentMovementPaidShort;
    case "cancelled":
      return copy.paymentMovementCancelledShort;
    case "failed":
      return copy.paymentMovementFailedShort;
    case "partially_refunded":
      return copy.paymentMovementPartialRefundShort;
    case "refunded":
      return copy.paymentMovementRefundedShort;
    default:
      return copy.paymentMovementFailedShort;
  }
}

export function formatPaymentHistoryAmount(
  amount: number,
  currency: string | null | undefined,
  locale: Locale,
) {
  const moneyText = formatOpsAmountOrDash(String(amount), locale);
  const cur = (currency ?? "").trim().toUpperCase();
  return cur ? `${moneyText} ${cur}` : moneyText;
}

export function formatPaymentHistoryWhen(
  iso: string | null | undefined,
  locale: Locale,
) {
  return formatOpsDateTime(iso ?? null, locale);
}

export function compactPaymentMovementLines(
  rows: OpsPaymentMovementCompactLine[],
  copy: OpsCopy,
  locale: Locale,
  maxVisible = 2,
): string[] {
  if (rows.length === 0) {
    return [];
  }
  const visible = rows.slice(0, maxVisible);
  const lines = visible.map((row) => {
    const id = row.providerOrderId?.trim() || "—";
    const amount = formatPaymentHistoryAmount(row.amount, row.currency, locale);
    const status = paymentMovementStatusShortLabel(row.displayStatus, copy);
    return `${id} · ${amount} · ${status}`;
  });
  const hidden = rows.length - visible.length;
  if (hidden > 0) {
    lines.push(
      copy.paymentMovementsMore.replace("{n}", String(hidden)),
    );
  }
  return lines;
}

export function toCompactPaymentLinesFromHistory(
  section: OpsPaymentHistorySection | null | undefined,
): OpsPaymentMovementCompactLine[] {
  if (!section) {
    return [];
  }
  return section.rows.map((row) => ({
    providerOrderId: row.providerOrderId,
    amount: row.amount,
    currency: row.currency,
    displayStatus: row.displayStatus,
  }));
}
