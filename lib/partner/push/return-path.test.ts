import assert from "node:assert/strict";
import test from "node:test";
import { safePartnerReturnPath } from "@/lib/partner/push/return-path";

test("safe partner return path accepts only partner portal routes", () => {
  assert.equal(
    safePartnerReturnPath("/tr/partner/jobs/11111111-1111-4111-8111-111111111111", "tr"),
    "/tr/partner/jobs/11111111-1111-4111-8111-111111111111",
  );
  assert.equal(safePartnerReturnPath("/tr/partner/jobs", "tr"), "/tr/partner/jobs");
  assert.equal(safePartnerReturnPath("/en/partner/jobs/x", "en"), null);
  assert.equal(safePartnerReturnPath("/tr/ops/reservations", "tr"), null);
  assert.equal(safePartnerReturnPath("https://evil.example/tr/partner/jobs", "tr"), null);
  assert.equal(safePartnerReturnPath("/tr/partner/login", "tr"), null);
  assert.equal(safePartnerReturnPath("/en/partner/jobs", "tr"), null);
  assert.equal(safePartnerReturnPath("/tr/partner/jobs/../../ops", "tr"), null);
  assert.equal(safePartnerReturnPath("/tr/partner/uetds", "tr"), "/tr/partner/uetds");
  assert.equal(
    safePartnerReturnPath("/tr/partner/uetds/notifications/new", "tr"),
    "/tr/partner/uetds/notifications/new",
  );
  assert.equal(
    safePartnerReturnPath("/tr/partner/uetds/notifications", "tr"),
    "/tr/partner/uetds/notifications",
  );
  assert.equal(safePartnerReturnPath("/tr/partner/uetds/companies", "tr"), null);
});
