import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canReactivateBosphorusBeforeServiceDayCutoff,
  evaluateCustomerCancel,
  evaluateCustomerEdit,
  evaluateCustomerReactivate,
  hasMoreThanSixHoursBeforePickup,
} from "@/lib/account/customer-status-policy";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";

test("cancel allowed only when more than 6 hours remain", () => {
  const pickup = istanbulLocalToUtcMs("2026-09-01T19:00");
  assert.equal(
    hasMoreThanSixHoursBeforePickup(pickup, pickup - 6 * 60 * 60 * 1000 - 60_000),
    true,
  );
  assert.equal(
    hasMoreThanSixHoursBeforePickup(pickup, pickup - 6 * 60 * 60 * 1000),
    false,
  );
  assert.equal(
    hasMoreThanSixHoursBeforePickup(pickup, pickup - 5 * 60 * 60 * 1000),
    false,
  );
  assert.equal(hasMoreThanSixHoursBeforePickup(pickup, pickup + 1000), false);
});

test("customer cancel gate", () => {
  const pickup = istanbulLocalToUtcMs("2026-09-01T19:00");
  assert.equal(
    evaluateCustomerCancel({
      status: "confirmed",
      pickupAt: pickup,
      nowUtcMs: pickup - 8 * 60 * 60 * 1000,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateCustomerCancel({
      status: "payment_pending",
      pickupAt: pickup,
      nowUtcMs: pickup - 6 * 60 * 60 * 1000,
    }).reason,
    "within_six_hours",
  );
  assert.equal(
    evaluateCustomerCancel({
      status: "cancelled",
      pickupAt: pickup,
      nowUtcMs: pickup - 8 * 60 * 60 * 1000,
    }).reason,
    "already_cancelled",
  );
});

test("customer edit gate allows confirmed and payment_pending when outside 6h", () => {
  const pickup = istanbulLocalToUtcMs("2026-09-10T12:00");
  const now = pickup - 8 * 60 * 60 * 1000;
  assert.equal(
    evaluateCustomerEdit({
      status: "confirmed",
      pickupAt: pickup,
      nowUtcMs: now,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateCustomerEdit({
      status: "payment_pending",
      pickupAt: pickup,
      nowUtcMs: now,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateCustomerEdit({
      status: "cancelled",
      pickupAt: pickup,
      nowUtcMs: now,
    }).reason,
    "cancelled",
  );
});

test("normal reactivate uses 6 hour rule", () => {
  const pickup = istanbulLocalToUtcMs("2026-09-01T12:00");
  assert.equal(
    evaluateCustomerReactivate({
      status: "cancelled",
      serviceType: "transfer",
      tourCode: null,
      pickupAt: pickup,
      nowUtcMs: pickup - 7 * 60 * 60 * 1000,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateCustomerReactivate({
      status: "cancelled",
      serviceType: "transfer",
      tourCode: null,
      pickupAt: pickup,
      nowUtcMs: pickup - 6 * 60 * 60 * 1000,
    }).reason,
    "within_six_hours",
  );
});

test("bosphorus reactivate uses service-day 19:00 cutoff, not 6h", () => {
  const pickup = istanbulLocalToUtcMs("2026-09-01T19:00");
  assert.equal(
    canReactivateBosphorusBeforeServiceDayCutoff(
      pickup,
      istanbulLocalToUtcMs("2026-09-01T18:00"),
    ),
    true,
  );
  assert.equal(
    canReactivateBosphorusBeforeServiceDayCutoff(
      pickup,
      istanbulLocalToUtcMs("2026-09-01T18:59"),
    ),
    true,
  );
  assert.equal(
    canReactivateBosphorusBeforeServiceDayCutoff(
      pickup,
      istanbulLocalToUtcMs("2026-09-01T19:00"),
    ),
    false,
  );
  assert.equal(
    evaluateCustomerReactivate({
      status: "cancelled",
      serviceType: "tour",
      tourCode: "bosphorus-dinner",
      pickupAt: pickup,
      nowUtcMs: istanbulLocalToUtcMs("2026-09-01T18:30"),
    }).allowed,
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
