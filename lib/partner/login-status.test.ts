import test from "node:test";
import assert from "node:assert/strict";
import { partnerLoginDenialAfterPassword } from "@/lib/partner/login-status";

test("login denial is revealed only after a password match", () => {
  assert.equal(
    partnerLoginDenialAfterPassword({
      userStatus: "active",
      partnerStatus: "active",
    }),
    null,
  );
  assert.equal(
    partnerLoginDenialAfterPassword({
      userStatus: "pending",
      partnerStatus: "pending",
    }),
    "pending",
  );
  assert.equal(
    partnerLoginDenialAfterPassword({
      userStatus: "inactive",
      partnerStatus: "inactive",
    }),
    "inactive",
  );
  assert.equal(
    partnerLoginDenialAfterPassword({
      userStatus: "active",
      partnerStatus: "inactive",
    }),
    "inactive",
  );
  assert.equal(
    partnerLoginDenialAfterPassword({
      userStatus: "pending",
      partnerStatus: "pending",
      deleted: true,
    }),
    "invalid",
  );
});
