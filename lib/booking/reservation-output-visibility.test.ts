import assert from "node:assert/strict";
import { test } from "node:test";
import {
  shouldShowDistance,
  shouldShowDropoff,
  shouldShowPaymentStatus,
} from "@/lib/booking/reservation-output-visibility";

test("cash hides payment status while other methods retain it", () => {
  assert.equal(shouldShowPaymentStatus("cash"), false);
  assert.equal(shouldShowPaymentStatus(" CASH "), false);
  assert.equal(shouldShowPaymentStatus("sbp"), true);
  assert.equal(shouldShowPaymentStatus(null), true);
});

test("only canonical transfer service renders dropoff", () => {
  assert.equal(shouldShowDropoff("transfer"), true);
  assert.equal(shouldShowDropoff(" TRANSFER "), true);
  assert.equal(shouldShowDropoff("hourly"), false);
  assert.equal(shouldShowDropoff("tour"), false);
  assert.equal(shouldShowDropoff(null), false);
});

test("only canonical transfer service renders route distance", () => {
  assert.equal(shouldShowDistance("transfer"), true);
  for (const serviceType of ["hourly", "tour", "custom", null]) {
    assert.equal(shouldShowDistance(serviceType), false);
  }
});

