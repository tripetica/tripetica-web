import test from "node:test";
import assert from "node:assert/strict";
import { formatPartnerCode } from "@/lib/partner/partner-code";

test("partner codes use PTR-#### display format", () => {
  assert.equal(formatPartnerCode(1), "PTR-0001");
  assert.equal(formatPartnerCode(12), "PTR-0012");
  assert.equal(formatPartnerCode(9999), "PTR-9999");
  assert.throws(() => formatPartnerCode(0));
});
