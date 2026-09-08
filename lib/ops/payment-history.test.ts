import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildOpsPaymentHistorySection,
  compactPaymentMovementLines,
  paymentMovementDisplayStatus,
  TURINVOICE_PENDING_ORDER_CANCEL_SUPPORTED,
} from "@/lib/ops/payment-history";
import { opsCopy } from "@/lib/ops/copy";
import type { LedgerPayment, LedgerRefundAllocation } from "@/lib/payments/ledger/math";

function payment(
  overrides: Partial<LedgerPayment> & Pick<LedgerPayment, "id" | "sequenceNo" | "amount" | "status">,
): LedgerPayment {
  return {
    internalReference: `TRP-TEST-P${overrides.sequenceNo}`,
    kind: overrides.sequenceNo === 1 ? "initial_payment" : "additional_payment",
    providerOrderId: `ORDER-${overrides.sequenceNo}`,
    currency: "RUB",
    createdAt: "2026-09-01T10:00:00.000Z",
    paidAt: overrides.status === "paid" ? "2026-09-01T10:05:00.000Z" : null,
    ...overrides,
  };
}

test("pending payments are not treated as collected in summary", () => {
  const payments = [
    payment({ id: "p1", sequenceNo: 1, amount: 5000, status: "pending", providerOrderId: "15034" }),
    payment({ id: "p2", sequenceNo: 2, amount: 8000, status: "pending", providerOrderId: "15102" }),
    payment({ id: "p3", sequenceNo: 3, amount: 12000, status: "paid", providerOrderId: "15240" }),
  ];
  const section = buildOpsPaymentHistorySection({
    payments,
    refunds: [],
    summary: {
      currency: "RUB",
      grossSuccessfulPayments: 12000,
      completedRefunds: 0,
      pendingRefunds: 0,
      netCollectedAmount: 12000,
      currentReservationTotal: 12000,
      differenceFromTotal: 0,
    },
  });
  assert.equal(section.rows.length, 3);
  assert.equal(section.rows[0]?.providerOrderId, "15034");
  assert.equal(section.rows[0]?.displayStatus, "pending");
  assert.equal(section.rows[2]?.displayStatus, "paid");
  assert.equal(section.summary.grossSuccessful, 12000);
  assert.equal(section.summary.netCollected, 12000);
});

test("partial and full refund display statuses", () => {
  assert.equal(
    paymentMovementDisplayStatus({ amount: 12000, status: "paid" }, 10000, 2000),
    "partially_refunded",
  );
  assert.equal(
    paymentMovementDisplayStatus({ amount: 12000, status: "paid" }, 0, 12000),
    "refunded",
  );
  assert.equal(
    paymentMovementDisplayStatus({ amount: 12000, status: "paid" }, 12000, 0),
    "paid",
  );
});

test("compact list shows overflow marker", () => {
  const lines = compactPaymentMovementLines(
    [
      { providerOrderId: "1", amount: 100, currency: "RUB", displayStatus: "pending" },
      { providerOrderId: "2", amount: 200, currency: "RUB", displayStatus: "pending" },
      { providerOrderId: "3", amount: 300, currency: "RUB", displayStatus: "paid" },
    ],
    opsCopy.tr,
    "tr",
    2,
  );
  assert.equal(lines.length, 3);
  assert.match(lines[2]!, /\+1/);
});

test("turinvoice pending order cancel is supported via DELETE order", () => {
  assert.equal(TURINVOICE_PENDING_ORDER_CANCEL_SUPPORTED, true);
});

test("two pending orders keep zero successful collection and separate rows", () => {
  const payments = [
    payment({ id: "p1", sequenceNo: 1, amount: 4753, status: "pending", providerOrderId: "15034" }),
    payment({ id: "p2", sequenceNo: 2, amount: 9080, status: "pending", providerOrderId: "15102" }),
  ];
  const section = buildOpsPaymentHistorySection({
    payments,
    refunds: [],
    summary: {
      currency: "RUB",
      grossSuccessfulPayments: 0,
      completedRefunds: 0,
      pendingRefunds: 0,
      netCollectedAmount: 0,
      currentReservationTotal: 9080,
      differenceFromTotal: 9080,
    },
  });
  assert.equal(section.rows.length, 2);
  assert.equal(section.summary.grossSuccessful, 0);
  assert.equal(section.summary.netCollected, 0);
  assert.equal(section.summary.remainingDue, 9080);
  assert.equal(section.rows[0]?.action, "cancel_order");
  assert.equal(section.rows[1]?.action, "cancel_order");
});

test("paid rows expose refund action, not cancel", () => {
  const section = buildOpsPaymentHistorySection({
    payments: [
      payment({ id: "p1", sequenceNo: 1, amount: 5000, status: "paid", providerOrderId: "A" }),
    ],
    refunds: [],
    summary: {
      currency: "RUB",
      grossSuccessfulPayments: 5000,
      completedRefunds: 0,
      pendingRefunds: 0,
      netCollectedAmount: 5000,
      currentReservationTotal: 5000,
      differenceFromTotal: 0,
    },
  });
  assert.equal(section.rows[0]?.action, "refund");
});

test("multi paid payments keep separate rows", () => {
  const payments = [
    payment({ id: "p1", sequenceNo: 1, amount: 5000, status: "paid", providerOrderId: "A" }),
    payment({ id: "p2", sequenceNo: 2, amount: 3000, status: "paid", providerOrderId: "B" }),
  ];
  const refunds: LedgerRefundAllocation[] = [];
  const section = buildOpsPaymentHistorySection({
    payments,
    refunds,
    summary: {
      currency: "RUB",
      grossSuccessfulPayments: 8000,
      completedRefunds: 0,
      pendingRefunds: 0,
      netCollectedAmount: 8000,
      currentReservationTotal: 8000,
      differenceFromTotal: 0,
    },
  });
  assert.deepEqual(
    section.rows.map((row) => row.providerOrderId),
    ["A", "B"],
  );
  assert.equal(section.summary.grossSuccessful, 8000);
});
