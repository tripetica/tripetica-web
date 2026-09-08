import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCTION_BASELINE_TABLES,
  summarizeSchemaCompatIssues,
} from "@/lib/db/baseline-schema-compat";

test("baseline table list includes 009 minute seq and 027 auth requests", () => {
  assert.ok(PRODUCTION_BASELINE_TABLES.includes("reservation_code_minute_seq"));
  assert.ok(PRODUCTION_BASELINE_TABLES.includes("customer_auth_requests"));
  assert.ok(PRODUCTION_BASELINE_TABLES.includes("reservation_code_daily_seq"));
});

test("schema compat summary is empty when there are no issues", () => {
  assert.equal(summarizeSchemaCompatIssues([]), null);
});

test("schema compat summary names the 009 gap explicitly", () => {
  assert.equal(
    summarizeSchemaCompatIssues([
      { kind: "missing_table", name: "reservation_code_minute_seq" },
    ]),
    "missing_table:reservation_code_minute_seq",
  );
});
