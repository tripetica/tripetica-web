import test from "node:test";
import assert from "node:assert/strict";
import { formatReservationCode } from "@/lib/ops/reservation-code";

test("reservation code uses TRP-YYYYMMDD-#### format", () => {
  assert.equal(formatReservationCode("2026-08-28", 1), "TRP-20260828-0001");
  assert.equal(formatReservationCode("2026-08-28", 12), "TRP-20260828-0012");
  assert.equal(formatReservationCode("2027-01-01", 9999), "TRP-20270101-9999");
});
