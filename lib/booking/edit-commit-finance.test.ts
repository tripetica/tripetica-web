import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeEditFinanceSettlement,
  planLifoRefundAllocation,
  remainingRefundableFromSummary,
  summarizeReservationFinances,
  type LedgerPayment,
  type LedgerRefundAllocation,
} from "@/lib/payments/ledger/math";

function payment(
  overrides: Partial<LedgerPayment> &
    Pick<LedgerPayment, "id" | "sequenceNo" | "amount">,
): LedgerPayment {
  return {
    internalReference: `A-P${overrides.sequenceNo}`,
    kind: overrides.sequenceNo === 1 ? "initial_payment" : "additional_payment",
    providerOrderId: `ORDER-${overrides.sequenceNo}`,
    currency: "RUB",
    status: "paid",
    createdAt: null,
    paidAt: null,
    ...overrides,
  };
}

test("remaining due uses latest committed total minus net collected", () => {
  const summary = summarizeReservationFinances({
    payments: [payment({ id: "p1", sequenceNo: 1, amount: 5000 })],
    refunds: [],
    currentReservationTotal: 8000,
    currentCurrency: "RUB",
  });
  assert.equal(summary.grossSuccessfulPayments, 5000);
  assert.equal(summary.netCollectedAmount, 5000);
  assert.equal(summary.differenceFromTotal, 3000);
});

test("pending orders do not count as successful collections", () => {
  const summary = summarizeReservationFinances({
    payments: [
      payment({ id: "p1", sequenceNo: 1, amount: 4753, status: "pending" }),
      payment({
        id: "p2",
        sequenceNo: 2,
        amount: 9080,
        status: "pending",
        kind: "additional_payment",
      }),
      payment({
        id: "p3",
        sequenceNo: 3,
        amount: 24588,
        status: "pending",
        kind: "additional_payment",
      }),
    ],
    refunds: [],
    currentReservationTotal: 24588,
    currentCurrency: "RUB",
  });
  assert.equal(summary.grossSuccessfulPayments, 0);
  assert.equal(summary.netCollectedAmount, 0);
  assert.equal(summary.differenceFromTotal, 24588);
  assert.equal(remainingRefundableFromSummary(summary), 0);
  const settlement = computeEditFinanceSettlement(0, 4500);
  assert.equal(settlement.mode, "additional_payment");
  assert.equal(settlement.amountRefund, 0);
});

test("cancel full refundable = 9000 when single paid collection", () => {
  const summary = summarizeReservationFinances({
    payments: [payment({ id: "p1", sequenceNo: 1, amount: 9000 })],
    refunds: [],
    currentReservationTotal: 9000,
    currentCurrency: "RUB",
  });
  assert.equal(remainingRefundableFromSummary(summary), 9000);
  const plan = planLifoRefundAllocation({
    requiredAmount: 9000,
    currency: "RUB",
    payments: [payment({ id: "p1", sequenceNo: 1, amount: 9000 })],
    refunds: [],
  });
  assert.ok(plan);
  assert.equal(plan!.reduce((sum, item) => sum + item.amount, 0), 9000);
});

test("cancel with no paid collections creates no refundable amount", () => {
  const summary = summarizeReservationFinances({
    payments: [
      payment({ id: "p1", sequenceNo: 1, amount: 9000, status: "pending" }),
    ],
    refunds: [],
    currentReservationTotal: 9000,
    currentCurrency: "RUB",
  });
  assert.equal(remainingRefundableFromSummary(summary), 0);
});

test("edit partial refund 9000 collected → 4500 new total", () => {
  const summary = summarizeReservationFinances({
    payments: [payment({ id: "p1", sequenceNo: 1, amount: 9000 })],
    refunds: [],
    currentReservationTotal: 4500,
    currentCurrency: "RUB",
  });
  assert.equal(summary.netCollectedAmount, 9000);
  const settlement = computeEditFinanceSettlement(
    summary.netCollectedAmount,
    4500,
  );
  assert.equal(settlement.mode, "refund");
  assert.equal(settlement.amountRefund, 4500);
  assert.equal(settlement.amountDue, 0);
});

test("edit partial refund across two successful collections", () => {
  const payments = [
    payment({ id: "p1", sequenceNo: 1, amount: 5000 }),
    payment({ id: "p2", sequenceNo: 2, amount: 3000 }),
  ];
  const summary = summarizeReservationFinances({
    payments,
    refunds: [],
    currentReservationTotal: 6500,
    currentCurrency: "RUB",
  });
  assert.equal(summary.grossSuccessfulPayments, 8000);
  assert.equal(summary.netCollectedAmount, 8000);
  const settlement = computeEditFinanceSettlement(
    summary.netCollectedAmount,
    6500,
  );
  assert.equal(settlement.mode, "refund");
  assert.equal(settlement.amountRefund, 1500);
  const plan = planLifoRefundAllocation({
    requiredAmount: settlement.amountRefund,
    currency: "RUB",
    payments,
    refunds: [],
  });
  assert.ok(plan);
  assert.deepEqual(
    plan!.map((item) => [item.sequenceNo, item.amount]),
    [[2, 1500]],
  );
});

test("prior completed refund reduces net collected for edit math", () => {
  const payments = [payment({ id: "p1", sequenceNo: 1, amount: 9000 })];
  const refunds: LedgerRefundAllocation[] = [
    {
      id: "r1",
      paymentTransactionId: "p1",
      amount: 1000,
      currency: "RUB",
      status: "completed",
    },
  ];
  const summary = summarizeReservationFinances({
    payments,
    refunds,
    currentReservationTotal: 4500,
    currentCurrency: "RUB",
  });
  assert.equal(summary.netCollectedAmount, 8000);
  assert.equal(remainingRefundableFromSummary(summary), 8000);
  const settlement = computeEditFinanceSettlement(
    summary.netCollectedAmount,
    4500,
  );
  assert.equal(settlement.amountRefund, 3500);
});

test("pending submitted refund blocks duplicate cancel remaining", () => {
  const summary = summarizeReservationFinances({
    payments: [payment({ id: "p1", sequenceNo: 1, amount: 9000 })],
    refunds: [
      {
        id: "r1",
        paymentTransactionId: "p1",
        amount: 9000,
        currency: "RUB",
        status: "submitted",
      },
    ],
    currentReservationTotal: 9000,
    currentCurrency: "RUB",
  });
  assert.equal(summary.netCollectedAmount, 9000);
  assert.equal(summary.pendingRefunds, 9000);
  assert.equal(remainingRefundableFromSummary(summary), 0);
});

test("edit additional payment when net below new total", () => {
  const settlement = computeEditFinanceSettlement(5000, 8000);
  assert.equal(settlement.mode, "additional_payment");
  assert.equal(settlement.amountDue, 3000);
  assert.equal(settlement.amountRefund, 0);
});

test("ops remaining due = current total − net collected", () => {
  const summary = summarizeReservationFinances({
    payments: [
      payment({ id: "p1", sequenceNo: 1, amount: 5000 }),
      payment({ id: "p2", sequenceNo: 2, amount: 3000 }),
    ],
    refunds: [
      {
        id: "r1",
        paymentTransactionId: "p2",
        amount: 1500,
        currency: "RUB",
        status: "completed",
      },
    ],
    currentReservationTotal: 6500,
    currentCurrency: "RUB",
  });
  assert.equal(summary.grossSuccessfulPayments, 8000);
  assert.equal(summary.completedRefunds, 1500);
  assert.equal(summary.netCollectedAmount, 6500);
  assert.equal(summary.differenceFromTotal, 0);
});
