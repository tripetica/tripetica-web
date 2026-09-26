import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("production SEARCH TRAVEL restore is deterministic and does not copy TEST credentials", () => {
  const script = source("scripts/restore-production-search-travel-uetds.ts");
  assert.match(script, /EXPECTED_DATABASE !== "tripetica"/);
  assert.match(script, /ALLOW_PRODUCTION_UETDS_COMPANY_RESTORE/);
  assert.match(script, /SEARCH TRAVEL/);
  assert.match(script, /RECEP/);
  assert.match(script, /YILDIRIM/);
  assert.match(script, /34EGP847/);
  assert.match(script, /uetds_company_id IS NULL/);
  assert.doesNotMatch(script, /UPDATE partner_drivers\s+SET uetds_company_id[\s\S]*WHERE deleted_at IS NULL\s*$/);
  assert.doesNotMatch(script, /testUsername|testPassword|test_password|UETDS_TEST_/);
  assert.doesNotMatch(script, /console\.log\([^\)]*PASSWORD|console\.log\([^\)]*legalName|console\.log\([^\)]*taxNumber/);
  assert.match(script, /saveOpsUetdsCompany/);
});
