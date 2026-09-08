import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeEditFinanceSettlement,
  planLifoRefundAllocation,
  refundableBalanceForPayment,
  remainingRefundableFromSummary,
  summarizeReservationFinances,
  type LedgerPayment,
  type LedgerRefundAllocation,
} from "@/lib/payments/ledger/math";

function payment(
  overrides: Partial<LedgerPayment> & Pick<LedgerPayment, "id" | "sequenceNo" | "amount">,
): LedgerPayment {
  return {
    internalReference: `TRP-TEST-P${overrides.sequenceNo}`,
    kind: overrides.sequenceNo === 1 ? "initial_payment" : "additional_payment",
    providerOrderId: `ORDER-${overrides.sequenceNo}`,
    currency: "RUB",
    status: "paid",
    createdAt: null,
    paidAt: null,
    ...overrides,
  };
}

test("refundable balance subtracts completed and pending", () => {
  const balance = refundableBalanceForPayment(payment({ id: "p2", sequenceNo: 2, amount: 5000 }), [
    { id: "r1", paymentTransactionId: "p2", amount: 1000, currency: "RUB", status: "completed" },
    { id: "r2", paymentTransactionId: "p2", amount: 500, currency: "RUB", status: "submitted" },
  ]);
  assert.equal(balance, 3500);
});

test("financial summary uses net collected = gross - completed", () => {
  const summary = summarizeReservationFinances({
    payments: [
      payment({ id: "p1", sequenceNo: 1, amount: 5000 }),
      payment({ id: "p2", sequenceNo: 2, amount: 3000 }),
    ],
    refunds: [
      {
        id: "r1",
        paymentTransactionId: "p1",
        amount: 1000,
        currency: "RUB",
        status: "completed",
      },
      {
        id: "r2",
        paymentTransactionId: "p2",
        amount: 500,
        currency: "RUB",
        status: "submitted",
      },
    ],
    currentReservationTotal: 7000,
    currentCurrency: "RUB",
  });
  assert.equal(summary.grossSuccessfulPayments, 8000);
  assert.equal(summary.completedRefunds, 1000);
  assert.equal(summary.pendingRefunds, 500);
  assert.equal(summary.netCollectedAmount, 7000);
  assert.equal(summary.differenceFromTotal, 0);
});

test("remainingRefundableFromSummary subtracts pending to avoid duplicate full refund", () => {
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
  assert.equal(remainingRefundableFromSummary(summary), 0);
});

test("computeEditFinanceSettlement matches ledger net vs new total", () => {
  assert.deepEqual(computeEditFinanceSettlement(9000, 4500), {
    mode: "refund",
    amountDue: 0,
    amountRefund: 4500,
  });
  assert.deepEqual(computeEditFinanceSettlement(8000, 6500), {
    mode: "refund",
    amountDue: 0,
    amountRefund: 1500,
  });
  assert.deepEqual(computeEditFinanceSettlement(5000, 5000), {
    mode: "zero_diff",
    amountDue: 0,
    amountRefund: 0,
  });
  assert.deepEqual(computeEditFinanceSettlement(5000, 8000), {
    mode: "additional_payment",
    amountDue: 3000,
    amountRefund: 0,
  });
});

test("LIFO refund allocation newest first", () => {
  const payments = [
    payment({ id: "p1", sequenceNo: 1, amount: 10000 }),
    payment({ id: "p2", sequenceNo: 2, amount: 3000 }),
    payment({ id: "p3", sequenceNo: 3, amount: 2000 }),
  ];
  const plan = planLifoRefundAllocation({
    requiredAmount: 3000,
    currency: "RUB",
    payments,
    refunds: [],
  });
  assert.ok(plan);
  assert.deepEqual(
    plan!.map((item) => [item.sequenceNo, item.amount]),
    [
      [3, 2000],
      [2, 1000],
    ],
  );
});

test("LIFO respects prior refunds and fails when insufficient", () => {
  const payments = [
    payment({ id: "p1", sequenceNo: 1, amount: 5000 }),
    payment({ id: "p2", sequenceNo: 2, amount: 5000 }),
    payment({ id: "p3", sequenceNo: 3, amount: 2000 }),
  ];
  const prior: LedgerRefundAllocation[] = [
    {
      id: "r1",
      paymentTransactionId: "p3",
      amount: 2000,
      currency: "RUB",
      status: "completed",
    },
    {
      id: "r2",
      paymentTransactionId: "p2",
      amount: 1000,
      currency: "RUB",
      status: "completed",
    },
  ];
  const plan = planLifoRefundAllocation({
    requiredAmount: 9000,
    currency: "RUB",
    payments,
    refunds: prior,
  });
  assert.ok(plan);
  assert.equal(
    plan!.reduce((sum, item) => sum + item.amount, 0),
    9000,
  );
  assert.equal(
    planLifoRefundAllocation({
      requiredAmount: 9001,
      currency: "RUB",
      payments,
      refunds: prior,
    }),
    null,
  );
});
