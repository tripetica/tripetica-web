import test from "node:test";
import assert from "node:assert/strict";
import {
  canDeleteOpsReservations,
  canEditOpsRecords,
} from "@/lib/ops/permissions";

test("only owner can delete ops reservations", () => {
  assert.equal(canDeleteOpsReservations("owner"), true);
  assert.equal(canDeleteOpsReservations("employee"), false);
  assert.equal(canEditOpsRecords("owner"), true);
  assert.equal(canEditOpsRecords("employee"), false);
});
