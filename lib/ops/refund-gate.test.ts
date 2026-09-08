import test from "node:test";
import assert from "node:assert/strict";
import { BOSPHORUS_DINNER_TOUR_CODE } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { BOSPHORUS_REFUND_WINDOW_MS } from "@/lib/ops/cancellation-policy";
import { evaluateOpsRefundGate } from "@/lib/ops/refund-gate";

const base = {
  status: "cancelled",
  paymentMethod: "sbp",
  paymentStatus: "paid",
  paymentProvider: "turinvoice",
  paymentProviderOrderId: "ord-1",
  paymentAmount: "18546.00",
  paymentCurrency: "RUB",
  refundStatus: null as string | null,
  serviceType: "tour",
  tourCode: BOSPHORUS_DINNER_TOUR_CODE,
  pickupAt: "2026-08-31T19:00:00.000Z",
};

test("active reservation blocks refund", () => {
  const result = evaluateOpsRefundGate({ ...base, status: "confirmed" });
  assert.deepEqual(result, { ok: false, reason: "not-cancelled" });
});

test("cash blocks online refund", () => {
  const result = evaluateOpsRefundGate({ ...base, paymentMethod: "cash" });
  assert.deepEqual(result, { ok: false, reason: "cash" });
});

test("unpaid online blocks refund", () => {
  const result = evaluateOpsRefundGate({ ...base, paymentStatus: "pending" });
  assert.deepEqual(result, { ok: false, reason: "not-paid" });
});

test("submitted refund blocks duplicate", () => {
  const result = evaluateOpsRefundGate({ ...base, refundStatus: "submitted" });
  assert.deepEqual(result, { ok: false, reason: "already-refunded" });
});

test("cancelled paid online allows refund without override inside window", () => {
  const nowUtcMs = Date.parse(base.pickupAt) - BOSPHORUS_REFUND_WINDOW_MS - 60_000;
  const result = evaluateOpsRefundGate({ ...base, nowUtcMs });
  assert.deepEqual(result, { ok: true, adminOverride: false });
});

test("cancelled paid online outside window requires admin override flag", () => {
  const nowUtcMs = Date.parse(base.pickupAt) - 60_000;
  const result = evaluateOpsRefundGate({ ...base, nowUtcMs });
  assert.deepEqual(result, { ok: true, adminOverride: true });
});
