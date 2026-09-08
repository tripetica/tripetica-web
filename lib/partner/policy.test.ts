import test from "node:test";
import assert from "node:assert/strict";
import {
  canActivateExternalPartner,
  canDeactivateExternalPartner,
  isPartnerAccountLoginEligible,
  isPartnerPasswordLengthValid,
  partnerPasswordsMatch,
} from "@/lib/partner/policy";

test("inactive or pending partner accounts cannot log in", () => {
  assert.equal(
    isPartnerAccountLoginEligible({ userStatus: "active", partnerStatus: "active" }),
    true,
  );
  assert.equal(
    isPartnerAccountLoginEligible({ userStatus: "inactive", partnerStatus: "active" }),
    false,
  );
  assert.equal(
    isPartnerAccountLoginEligible({ userStatus: "active", partnerStatus: "inactive" }),
    false,
  );
  assert.equal(
    isPartnerAccountLoginEligible({ userStatus: "pending", partnerStatus: "pending" }),
    false,
  );
  assert.equal(
    isPartnerAccountLoginEligible({ userStatus: "active", partnerStatus: "pending" }),
    false,
  );
});

test("external partner activation requires priority and complete fields", () => {
  const ready = {
    isPrimaryPartner: false,
    status: "pending" as const,
    priorityLevel: 2,
    hasRequiredFields: true,
  };
  assert.equal(canActivateExternalPartner(ready), true);
  assert.equal(canActivateExternalPartner({ ...ready, priorityLevel: null }), false);
  assert.equal(canActivateExternalPartner({ ...ready, hasRequiredFields: false }), false);
  assert.equal(canActivateExternalPartner({ ...ready, isPrimaryPartner: true }), false);
  assert.equal(canActivateExternalPartner({ ...ready, status: "active" }), false);
  assert.equal(canActivateExternalPartner({ ...ready, status: "inactive" }), true);
  assert.equal(
    canDeactivateExternalPartner({ isPrimaryPartner: false, status: "active" }),
    true,
  );
  assert.equal(
    canDeactivateExternalPartner({ isPrimaryPartner: true, status: "active" }),
    true,
  );
  assert.equal(
    canDeactivateExternalPartner({ isPrimaryPartner: true, status: "pending" }),
    false,
  );
});

test("partner password confirmation and length rules", () => {
  assert.equal(isPartnerPasswordLengthValid("1234567"), false);
  assert.equal(isPartnerPasswordLengthValid("12345678"), true);
  assert.equal(isPartnerPasswordLengthValid("long-enough"), true);
  assert.equal(partnerPasswordsMatch("same-password", "same-password"), true);
  assert.equal(partnerPasswordsMatch("same-password", "other-password"), false);
});
