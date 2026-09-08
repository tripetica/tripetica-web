import assert from "node:assert/strict";
import { test } from "node:test";
import { computeEditPriceDifference } from "@/lib/booking/edit-price-diff";
import { evaluateCustomerEdit } from "@/lib/account/customer-status-policy";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";

test("edit price difference same currency", () => {
  assert.deepEqual(
    computeEditPriceDifference({
      originalTotal: 5000,
      originalCurrency: "RUB",
      newTotal: 10000,
      newCurrency: "rub",
    }),
    {
      originalTotal: 5000,
      originalCurrency: "RUB",
      newTotal: 10000,
      newCurrency: "RUB",
      difference: 5000,
      sameCurrency: true,
    },
  );
  assert.equal(
    computeEditPriceDifference({
      originalTotal: 5000,
      originalCurrency: "RUB",
      newTotal: 4000,
      newCurrency: "RUB",
    }).difference,
    -1000,
  );
});

test("edit price difference different currency yields null diff", () => {
  const result = computeEditPriceDifference({
    originalTotal: 5000,
    originalCurrency: "RUB",
    newTotal: 100,
    newCurrency: "EUR",
  });
  assert.equal(result.sameCurrency, false);
  assert.equal(result.difference, null);
});

test("customer edit gate mirrors 6 hour rule", () => {
  const pickup = istanbulLocalToUtcMs("2026-09-01T19:00");
  assert.equal(
    evaluateCustomerEdit({
      status: "confirmed",
      pickupAt: pickup,
      nowUtcMs: pickup - 8 * 60 * 60 * 1000,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateCustomerEdit({
      status: "payment_pending",
      pickupAt: pickup,
      nowUtcMs: pickup - 6 * 60 * 60 * 1000,
    }).reason,
    "within_six_hours",
  );
  assert.equal(
    evaluateCustomerEdit({
      status: "cancelled",
      pickupAt: pickup,
      nowUtcMs: pickup - 8 * 60 * 60 * 1000,
    }).reason,
    "cancelled",
  );
});
