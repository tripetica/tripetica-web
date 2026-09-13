import assert from "node:assert/strict";
import { test } from "node:test";
import { reservationWaitingPolicyKind } from "@/lib/booking/reservation-document-policy";
import { voucherCopy } from "@/lib/booking/voucher-copy";

test("reservation documents select waiting policy from canonical service data", () => {
  assert.equal(reservationWaitingPolicyKind("transfer", null), "transfer");
  assert.equal(reservationWaitingPolicyKind("hourly", null), "hourly");
  assert.equal(
    reservationWaitingPolicyKind("tour", "istanbul-layover"),
    "tour",
  );
  assert.equal(reservationWaitingPolicyKind("tour", "bursa"), "tour");
  assert.equal(
    reservationWaitingPolicyKind("tour", "bosphorus-dinner"),
    null,
  );
});

test("TR EN RU AR contain distinct hourly and vehicle-tour waiting copy", () => {
  for (const locale of ["tr", "en", "ru", "ar"] as const) {
    const copy = voucherCopy[locale];
    assert.ok(copy.policyWaitingBody.includes("90"));
    assert.ok(copy.policyWaitingBody.includes("30"));
    assert.ok(copy.policyWaitingBody.includes("20"));
    assert.notEqual(copy.policyHourlyWaitingBody, copy.policyNoShowBody);
    assert.notEqual(copy.policyTourWaitingBody, copy.policyNoShowBody);
    assert.match(copy.policyHourlyWaitingBody, /No-Show/);
    assert.match(copy.policyTourWaitingBody, /No-Show/);
  }
});
