import test from "node:test";
import assert from "node:assert/strict";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import {
  CHECKOUT_PREP_TOLERANCE_MS,
  evaluateCheckoutPickupPrep,
  hasSufficientCheckoutPrepTime,
  suggestedCheckoutPickupLocal,
} from "@/lib/booking/checkout-pickup-prep";

test("70 minutes remaining passes checkout prep check", () => {
  const nowUtcMs = istanbulLocalToUtcMs("2026-08-28T19:00");
  const pickupAt = new Date(nowUtcMs + 70 * 60 * 1000);
  assert.equal(hasSufficientCheckoutPrepTime(pickupAt, nowUtcMs), true);
  assert.deepEqual(evaluateCheckoutPickupPrep(pickupAt, nowUtcMs), { ok: true });
});

test("exactly 50 minutes remaining passes checkout prep check", () => {
  const nowUtcMs = istanbulLocalToUtcMs("2026-08-28T19:00");
  const pickupAt = new Date(nowUtcMs + CHECKOUT_PREP_TOLERANCE_MS);
  assert.equal(hasSufficientCheckoutPrepTime(pickupAt, nowUtcMs), true);
});

test("49 minutes 59 seconds remaining triggers prep confirmation", () => {
  const nowUtcMs = istanbulLocalToUtcMs("2026-08-28T19:00");
  const pickupAt = new Date(nowUtcMs + CHECKOUT_PREP_TOLERANCE_MS - 1000);
  const result = evaluateCheckoutPickupPrep(pickupAt, nowUtcMs);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.suggestedPickupAtLocal, "2026-08-28T20:00");
  }
});

test("suggested checkout pickup rounds 19:43 to 20:45", () => {
  const nowUtcMs = istanbulLocalToUtcMs("2026-08-28T19:43");
  assert.equal(suggestedCheckoutPickupLocal(nowUtcMs), "2026-08-28T20:45");
});

test("suggested checkout pickup keeps 19:30 at 20:30", () => {
  const nowUtcMs = istanbulLocalToUtcMs("2026-08-28T19:30");
  assert.equal(suggestedCheckoutPickupLocal(nowUtcMs), "2026-08-28T20:30");
});

test("suggested checkout pickup rolls to next day after 23:58", () => {
  const nowUtcMs = istanbulLocalToUtcMs("2026-08-28T23:58");
  assert.equal(suggestedCheckoutPickupLocal(nowUtcMs), "2026-08-29T01:00");
});
