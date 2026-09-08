/** Pure financial helpers for online payment ledger (no I/O). */

export const PAYMENT_TXN_PENDING = "pending" as const;
export const PAYMENT_TXN_PAID = "paid" as const;
export const PAYMENT_TXN_CANCELLED = "cancelled" as const;
export const PAYMENT_TXN_EXPIRED = "expired" as const;

export const REFUND_ALLOC_PLANNED = "planned" as const;
export const REFUND_ALLOC_SUBMITTED = "submitted" as const;
export const REFUND_ALLOC_COMPLETED = "completed" as const;
export const REFUND_ALLOC_FAILED = "failed" as const;

export const REFUND_BATCH_PLANNED = "planned" as const;
export const REFUND_BATCH_SUBMITTED = "submitted" as const;
export const REFUND_BATCH_PARTIAL = "partial" as const;
export const REFUND_BATCH_FAILED = "failed" as const;
export const REFUND_BATCH_COMPLETED = "completed" as const;

export type PaymentTxnStatus =
  | typeof PAYMENT_TXN_PENDING
  | typeof PAYMENT_TXN_PAID
  | typeof PAYMENT_TXN_CANCELLED
  | typeof PAYMENT_TXN_EXPIRED;

export type RefundAllocStatus =
  | typeof REFUND_ALLOC_PLANNED
  | typeof REFUND_ALLOC_SUBMITTED
  | typeof REFUND_ALLOC_COMPLETED
  | typeof REFUND_ALLOC_FAILED;

export type LedgerPayment = {
  id: string;
  sequenceNo: number;
  internalReference: string;
  kind: "initial_payment" | "additional_payment";
  providerOrderId: string | null;
  amount: number;
  currency: string;
  status: PaymentTxnStatus;
  createdAt: string | null;
  paidAt: string | null;
};

export type LedgerRefundAllocation = {
  id: string;
  paymentTransactionId: string;
  amount: number;
  currency: string;
  status: RefundAllocStatus;
};

export type FinancialSummary = {
  currency: string | null;
  grossSuccessfulPayments: number;
  completedRefunds: number;
  pendingRefunds: number;
  netCollectedAmount: number;
  currentReservationTotal: number | null;
  differenceFromTotal: number | null;
};

export type LifoAllocationItem = {
  paymentTransactionId: string;
  sequenceNo: number;
  providerOrderId: string;
  amount: number;
  currency: string;
  internalReference: string;
};

function money(value: number) {
  return Number(value.toFixed(2));
}

export function paymentInternalReference(
  reservationCode: string,
  sequenceNo: number,
) {
  return `${reservationCode.trim()}-P${sequenceNo}`;
}

export function isPaidPaymentStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase() === PAYMENT_TXN_PAID;
}

export function isOpenRefundStatus(status: string | null | undefined) {
  const raw = (status ?? "").trim().toLowerCase();
  return raw === REFUND_ALLOC_SUBMITTED || raw === REFUND_ALLOC_COMPLETED;
}

export function refundableBalanceForPayment(
  payment: Pick<LedgerPayment, "amount" | "status" | "currency">,
  allocations: Array<
    Pick<LedgerRefundAllocation, "amount" | "status" | "currency"> & {
      paymentTransactionId?: string;
      id?: string;
    }
  >,
): number {
  if (!isPaidPaymentStatus(payment.status)) {
    return 0;
  }
  let used = 0;
  for (const alloc of allocations) {
    if (!isOpenRefundStatus(alloc.status)) {
      continue;
    }
    if (
      alloc.currency.trim().toUpperCase() !==
      payment.currency.trim().toUpperCase()
    ) {
      continue;
    }
    used += alloc.amount;
  }
  return money(Math.max(0, payment.amount - used));
}

/**
 * Remaining amount that can still be refunded without duplicating open refunds.
 * refundable = successful collections − completed refunds − pending (submitted) refunds.
 */
export function remainingRefundableFromSummary(
  summary: Pick<
    FinancialSummary,
    "grossSuccessfulPayments" | "completedRefunds" | "pendingRefunds"
  >,
) {
  return money(
    summary.grossSuccessfulPayments -
      summary.completedRefunds -
      summary.pendingRefunds,
  );
}

/**
 * Edit settlement from ledger net collected vs new reservation gross total.
 * netCollected = successful collections − completed refunds (pending excluded from net).
 * refundDue / amountDue use that net vs newTotal; LIFO still blocks over-refund via pending.
 */
export function computeEditFinanceSettlement(
  netCollected: number,
  newReservationGrossTotal: number,
): {
  mode: "zero_diff" | "additional_payment" | "refund";
  amountDue: number;
  amountRefund: number;
} {
  const diff = money(newReservationGrossTotal - netCollected);
  if (diff > 0) {
    return { mode: "additional_payment", amountDue: diff, amountRefund: 0 };
  }
  if (diff < 0) {
    return {
      mode: "refund",
      amountDue: 0,
      amountRefund: money(Math.abs(diff)),
    };
  }
  return { mode: "zero_diff", amountDue: 0, amountRefund: 0 };
}

export function summarizeReservationFinances(input: {
  payments: LedgerPayment[];
  refunds: LedgerRefundAllocation[];
  currentReservationTotal: number | null;
  currentCurrency: string | null;
}): FinancialSummary {
  const currency =
    input.currentCurrency?.trim().toUpperCase() ||
    input.payments.find((p) => p.currency)?.currency?.trim().toUpperCase() ||
    null;

  let gross = 0;
  let completed = 0;
  let pending = 0;

  for (const payment of input.payments) {
    if (!isPaidPaymentStatus(payment.status)) {
      continue;
    }
    if (
      currency &&
      payment.currency.trim().toUpperCase() !== currency
    ) {
      continue;
    }
    gross += payment.amount;
  }

  for (const refund of input.refunds) {
    if (
      currency &&
      refund.currency.trim().toUpperCase() !== currency
    ) {
      continue;
    }
    if (refund.status === REFUND_ALLOC_COMPLETED) {
      completed += refund.amount;
    } else if (refund.status === REFUND_ALLOC_SUBMITTED) {
      pending += refund.amount;
    }
  }

  const net = money(gross - completed);
  const total = input.currentReservationTotal;
  return {
    currency,
    grossSuccessfulPayments: money(gross),
    completedRefunds: money(completed),
    pendingRefunds: money(pending),
    netCollectedAmount: net,
    currentReservationTotal: total,
    differenceFromTotal:
      total != null && currency
        ? money(total - net)
        : null,
  };
}

/**
 * LIFO: allocate required refund from newest paid payments with refundable balance.
 * Returns null when insufficient refundable funds.
 */
export function planLifoRefundAllocation(input: {
  requiredAmount: number;
  currency: string;
  payments: LedgerPayment[];
  refunds: LedgerRefundAllocation[];
}): LifoAllocationItem[] | null {
  const required = money(input.requiredAmount);
  if (!(required > 0)) {
    return [];
  }
  const currency = input.currency.trim().toUpperCase();
  const refundsByPayment = new Map<string, LedgerRefundAllocation[]>();
  for (const refund of input.refunds) {
    const list = refundsByPayment.get(refund.paymentTransactionId) ?? [];
    list.push(refund);
    refundsByPayment.set(refund.paymentTransactionId, list);
  }

  const ordered = [...input.payments]
    .filter(
      (p) =>
        isPaidPaymentStatus(p.status) &&
        p.providerOrderId?.trim() &&
        p.currency.trim().toUpperCase() === currency,
    )
    .sort((a, b) => b.sequenceNo - a.sequenceNo);

  let remaining = required;
  const plan: LifoAllocationItem[] = [];
  for (const payment of ordered) {
    if (remaining <= 0) {
      break;
    }
    const balance = refundableBalanceForPayment(
      payment,
      refundsByPayment.get(payment.id) ?? [],
    );
    if (balance <= 0) {
      continue;
    }
    const take = money(Math.min(balance, remaining));
    plan.push({
      paymentTransactionId: payment.id,
      sequenceNo: payment.sequenceNo,
      providerOrderId: payment.providerOrderId!.trim(),
      amount: take,
      currency,
      internalReference: payment.internalReference,
    });
    remaining = money(remaining - take);
  }

  if (remaining > 0) {
    return null;
  }
  return plan;
}

export function refundBatchStatusFromAllocations(
  allocations: Array<{ status: RefundAllocStatus }>,
): typeof REFUND_BATCH_SUBMITTED | typeof REFUND_BATCH_PARTIAL | typeof REFUND_BATCH_FAILED | typeof REFUND_BATCH_COMPLETED | typeof REFUND_BATCH_PLANNED {
  if (allocations.length === 0) {
    return REFUND_BATCH_PLANNED;
  }
  const submitted = allocations.filter((a) => a.status === REFUND_ALLOC_SUBMITTED).length;
  const completed = allocations.filter((a) => a.status === REFUND_ALLOC_COMPLETED).length;
  const failed = allocations.filter((a) => a.status === REFUND_ALLOC_FAILED).length;
  const planned = allocations.filter((a) => a.status === REFUND_ALLOC_PLANNED).length;
  if (failed > 0 && (submitted > 0 || completed > 0)) {
    return REFUND_BATCH_PARTIAL;
  }
  if (failed === allocations.length) {
    return REFUND_BATCH_FAILED;
  }
  if (completed === allocations.length) {
    return REFUND_BATCH_COMPLETED;
  }
  if (planned === allocations.length) {
    return REFUND_BATCH_PLANNED;
  }
  if (failed > 0) {
    return REFUND_BATCH_PARTIAL;
  }
  return REFUND_BATCH_SUBMITTED;
}
