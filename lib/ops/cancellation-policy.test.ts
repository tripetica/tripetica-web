import test from "node:test";
import assert from "node:assert/strict";
import { BOSPHORUS_DINNER_TOUR_CODE } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import {
  BOSPHORUS_REFUND_WINDOW_MS,
  evaluateOpsCancelPolicy,
} from "@/lib/ops/cancellation-policy";

test("non-bosphorus services use standard cancel window", () => {
  const result = evaluateOpsCancelPolicy({
    serviceType: "transfer",
    tourCode: null,
    pickupAt: "2026-08-31T19:00:00.000Z",
    nowUtcMs: Date.parse("2026-08-31T10:00:00.000Z"),
  });
  assert.equal(result.kind, "standard");
  assert.equal(result.withinRefundWindow, true);
});

test("exactly 6h is outside refund window", () => {
  const pickupAt = "2026-08-31T19:00:00.000Z";
  const nowUtcMs = Date.parse(pickupAt) - BOSPHORUS_REFUND_WINDOW_MS;
  const result = evaluateOpsCancelPolicy({
    serviceType: "tour",
    tourCode: BOSPHORUS_DINNER_TOUR_CODE,
    pickupAt,
    nowUtcMs,
  });
  assert.equal(result.kind, "bosphorus-dinner");
  assert.equal(result.withinRefundWindow, false);
});

test("more than 6h is inside policy", () => {
  const pickupAt = "2026-08-31T19:00:00.000Z";
  const nowUtcMs = Date.parse(pickupAt) - BOSPHORUS_REFUND_WINDOW_MS - 1000;
  const result = evaluateOpsCancelPolicy({
    serviceType: "tour",
    tourCode: BOSPHORUS_DINNER_TOUR_CODE,
    pickupAt,
    nowUtcMs,
  });
  assert.equal(result.kind, "bosphorus-dinner");
  assert.equal(result.withinRefundWindow, true);
});

test("bosphorus under 6h is outside policy", () => {
  const pickupAt = "2026-08-31T19:00:00.000Z";
  const nowUtcMs = Date.parse(pickupAt) - BOSPHORUS_REFUND_WINDOW_MS + 1000;
  const result = evaluateOpsCancelPolicy({
    serviceType: "tour",
    tourCode: BOSPHORUS_DINNER_TOUR_CODE,
    pickupAt,
    nowUtcMs,
  });
  assert.equal(result.kind, "bosphorus-dinner");
  assert.equal(result.withinRefundWindow, false);
});
