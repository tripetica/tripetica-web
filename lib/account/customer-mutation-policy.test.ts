import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canMutateCustomerReservation,
  CUSTOMER_MUTATION_WINDOW_MS,
  hasMoreThanMutationWindowBeforePickup,
} from "@/lib/booking/customer-mutation-policy";
import {
  canReactivateBosphorusBeforeServiceDayCutoff,
  evaluateCustomerCancel,
  evaluateCustomerEdit,
  evaluateCustomerReactivate,
  hasMoreThanSixHoursBeforePickup,
} from "@/lib/account/customer-status-policy";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import {
  BOSPHORUS_REFUND_WINDOW_MS,
  evaluateOpsCancelPolicy,
} from "@/lib/ops/cancellation-policy";
import { BOSPHORUS_DINNER_TOUR_CODE } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { legalDocuments } from "@/lib/legal/copy";
import { voucherCopy } from "@/lib/booking/voucher-copy";
import { bosphorusDinnerCopy } from "@/lib/booking/bosphorus-dinner-copy";
import {
  planLifoRefundAllocation,
  summarizeReservationFinances,
  type LedgerPayment,
  type LedgerRefundAllocation,
} from "@/lib/payments/ledger/math";

test("A: overnight 3h remaining blocks cancel and edit", () => {
  const now = istanbulLocalToUtcMs("2026-09-01T23:00");
  const pickup = istanbulLocalToUtcMs("2026-09-02T02:00");
  assert.equal(hasMoreThanMutationWindowBeforePickup(pickup, now), false);
  assert.equal(
    evaluateCustomerCancel({
      status: "confirmed",
      pickupAt: pickup,
      nowUtcMs: now,
    }).allowed,
    false,
  );
  assert.equal(
    evaluateCustomerEdit({
      status: "confirmed",
      pickupAt: pickup,
      nowUtcMs: now,
    }).allowed,
    false,
  );
});

test("B: overnight 9h remaining allows cancel and edit", () => {
  const now = istanbulLocalToUtcMs("2026-09-01T23:00");
  const pickup = istanbulLocalToUtcMs("2026-09-02T08:00");
  assert.equal(hasMoreThanMutationWindowBeforePickup(pickup, now), true);
  assert.equal(
    evaluateCustomerCancel({
      status: "confirmed",
      pickupAt: pickup,
      nowUtcMs: now,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateCustomerEdit({
      status: "confirmed",
      pickupAt: pickup,
      nowUtcMs: now,
    }).allowed,
    true,
  );
});

test("C: same day 7h allows", () => {
  const now = istanbulLocalToUtcMs("2026-09-01T10:00");
  const pickup = istanbulLocalToUtcMs("2026-09-01T17:00");
  assert.equal(canMutateCustomerReservation({ pickupAt: pickup, nowUtcMs: now }), true);
});

test("D: exactly 6h blocks", () => {
  const pickup = istanbulLocalToUtcMs("2026-09-01T16:00");
  const now = istanbulLocalToUtcMs("2026-09-01T10:00");
  assert.equal(pickup - now, CUSTOMER_MUTATION_WINDOW_MS);
  assert.equal(hasMoreThanSixHoursBeforePickup(pickup, now), false);
  assert.equal(
    evaluateCustomerCancel({
      status: "confirmed",
      pickupAt: pickup,
      nowUtcMs: now,
    }).reason,
    "within_six_hours",
  );
  assert.equal(
    evaluateCustomerEdit({
      status: "confirmed",
      pickupAt: pickup,
      nowUtcMs: now,
    }).reason,
    "within_six_hours",
  );
});

test("E: under 6h blocks", () => {
  const now = istanbulLocalToUtcMs("2026-09-01T10:00");
  const pickup = istanbulLocalToUtcMs("2026-09-01T15:59");
  assert.equal(hasMoreThanMutationWindowBeforePickup(pickup, now), false);
});

test("ops cancel policy uses strict > 6h boundary", () => {
  const pickupAt = "2026-08-31T19:00:00.000Z";
  const atExact = evaluateOpsCancelPolicy({
    serviceType: "tour",
    tourCode: BOSPHORUS_DINNER_TOUR_CODE,
    pickupAt,
    nowUtcMs: Date.parse(pickupAt) - BOSPHORUS_REFUND_WINDOW_MS,
  });
  assert.equal(atExact.withinRefundWindow, false);

  const inside = evaluateOpsCancelPolicy({
    serviceType: "tour",
    tourCode: BOSPHORUS_DINNER_TOUR_CODE,
    pickupAt,
    nowUtcMs: Date.parse(pickupAt) - BOSPHORUS_REFUND_WINDOW_MS - 1000,
  });
  assert.equal(inside.withinRefundWindow, true);

  const transfer = evaluateOpsCancelPolicy({
    serviceType: "transfer",
    tourCode: null,
    pickupAt,
    nowUtcMs: Date.parse(pickupAt) - BOSPHORUS_REFUND_WINDOW_MS - 1000,
  });
  assert.equal(transfer.kind, "standard");
  assert.equal(transfer.withinRefundWindow, true);
});

test("H/I: multiple paid orders refund only remaining net collected", () => {
  const payments: LedgerPayment[] = [
    {
      id: "p1",
      sequenceNo: 1,
      internalReference: "R-P1",
      kind: "initial_payment",
      providerOrderId: "ord-a",
      amount: 5000,
      currency: "RUB",
      status: "paid",
      createdAt: null,
      paidAt: null,
    },
    {
      id: "p2",
      sequenceNo: 2,
      internalReference: "R-P2",
      kind: "additional_payment",
      providerOrderId: "ord-b",
      amount: 3000,
      currency: "RUB",
      status: "paid",
      createdAt: null,
      paidAt: null,
    },
  ];
  const prior: LedgerRefundAllocation[] = [
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
    refunds: prior,
    currentReservationTotal: 8000,
    currentCurrency: "RUB",
  });
  assert.equal(summary.grossSuccessfulPayments, 8000);
  assert.equal(summary.completedRefunds, 1000);
  assert.equal(summary.netCollectedAmount, 7000);

  const remaining = Number(
    (
      summary.grossSuccessfulPayments -
      summary.completedRefunds -
      summary.pendingRefunds
    ).toFixed(2),
  );
  assert.equal(remaining, 7000);

  const plan = planLifoRefundAllocation({
    requiredAmount: remaining,
    currency: "RUB",
    payments,
    refunds: prior,
  });
  assert.ok(plan);
  assert.equal(
    Number(plan!.reduce((sum, item) => sum + item.amount, 0).toFixed(2)),
    7000,
  );
});

test("reactivate bosphorus cutoff unchanged", () => {
  const pickup = istanbulLocalToUtcMs("2026-09-01T19:00");
  assert.equal(
    canReactivateBosphorusBeforeServiceDayCutoff(
      pickup,
      istanbulLocalToUtcMs("2026-09-01T18:59"),
    ),
    true,
  );
  assert.equal(
    evaluateCustomerReactivate({
      status: "cancelled",
      serviceType: "tour",
      tourCode: "bosphorus-dinner",
      pickupAt: pickup,
      nowUtcMs: istanbulLocalToUtcMs("2026-09-01T19:00"),
    }).reason,
    "bosphorus_after_cutoff",
  );
});

test("K: legal and voucher cancellation policy has no 12h window", () => {
  const blob = JSON.stringify({
    legal: legalDocuments,
    voucher: voucherCopy,
    bosphorus: {
      tr: bosphorusDinnerCopy.tr.voucherCancelBody,
      en: bosphorusDinnerCopy.en.voucherCancelBody,
      ru: bosphorusDinnerCopy.ru.voucherCancelBody,
    },
  });
  assert.equal(/12\s*saat/i.test(blob), false);
  assert.equal(/12\s*hours?/i.test(blob), false);
  assert.equal(/12\s*час/i.test(blob), false);
});
