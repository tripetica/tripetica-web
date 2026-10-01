import test from "node:test";
import assert from "node:assert/strict";
import { getDriverMembership, saveDriverMembership } from "../ops/driver-membership-store";
import { isDriverMembershipStatus } from "../ops/driver-membership";

test("membership defaults to standard and persists independently of subscription", async () => {
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const previous = globals.tripeticaPgPool;
  let status = "standard";
  let updates = 0;
  globals.tripeticaPgPool = { query: async (sql: string, values: string[]) => {
    assert.doesNotMatch(sql, /uetds_subscription|monthly_fee|currency|periods/);
    if (sql.startsWith("UPDATE")) {
      assert.equal(values[1], "partner");
      status = values[2]; updates++;
      return { rows: [{ id: "driver" }] };
    }
    return { rows: [{ membership_status: status }] };
  } };
  try {
    assert.equal(await getDriverMembership("driver"), "standard");
    assert.equal(await saveDriverMembership("partner", "driver", "gold"), true);
    assert.equal(await getDriverMembership("driver"), "gold");
    assert.equal(await saveDriverMembership("partner", "driver", "standard"), true);
    assert.equal(await getDriverMembership("driver"), "standard");
    assert.equal(updates, 2);
    assert.equal(isDriverMembershipStatus("premium"), false);
    assert.equal(isDriverMembershipStatus(true), false);
  } finally { globals.tripeticaPgPool = previous; }
});
