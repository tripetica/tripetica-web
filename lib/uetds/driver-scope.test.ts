import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { type UetdsDraft } from "@/lib/uetds/draft";
import { clampDriverUetdsDraft, forceDriverUetdsIdentity } from "@/lib/uetds/driver-scope";

test("driver draft identity is forced and unauthorized vehicles are rejected", () => {
  const draft = { driverId: "other-driver", vehicleId: "vehicle-a" } as UetdsDraft;
  const forced = forceDriverUetdsIdentity(draft, "session-driver");
  assert.equal(forced.driverId, "session-driver");
  assert.equal(clampDriverUetdsDraft(forced, { driverId: "session-driver", vehicleIds: ["vehicle-a"] })?.driverId, "session-driver");
  assert.equal(clampDriverUetdsDraft(forced, { driverId: "session-driver", vehicleIds: ["vehicle-b"] }), null);
});

test("driver portal U-ETDS stays on the session actor and lists filter by driver", () => {
  const actions = readFileSync("lib/uetds/notification-actions.ts", "utf8");
  const list = readFileSync("lib/uetds/notifications.ts", "utf8");
  const access = readFileSync("lib/uetds/driver-access.ts", "utf8");
  assert.match(actions, /getDriverPortalActor\(\)/);
  assert.match(actions, /raw !== "partner"/);
  assert.match(list, /driver_id = \$4/);
  assert.match(list, /vehicle_id = ANY\(\$5::uuid\[\]\)/);
  assert.match(list, /driver_id = \$3/);
  assert.match(list, /vehicle_id = ANY\(\$4::uuid\[\]\)/);
  assert.match(access, /fd\.driver_id = \$2/);
  assert.match(access, /vehicle_id = ANY\(\$4::uuid\[\]\)/);
  const tabs = readFileSync("components/driver-portal/driver-uetds-tabs.tsx", "utf8");
  const listPage = readFileSync("app/[locale]/(driver-portal)/driver/uetds/page.tsx", "utf8");
  const newPage = readFileSync("app/[locale]/(driver-portal)/driver/uetds/new/page.tsx", "utf8");
  assert.match(tabs, /myNotifications/);
  assert.match(readFileSync("lib/driver-portal/copy.ts", "utf8"), /myNotifications: "Bildirimlerim"/);
  assert.match(tabs, /\/driver\/uetds\/new/);
  assert.match(listPage, /DriverUetdsTabs/);
  assert.match(listPage, /driverUetdsScope/);
  assert.match(listPage, /driver-portal ops-app/);
  assert.match(newPage, /current="new"/);
  assert.match(newPage, /driver-portal ops-app/);
  assert.match(readFileSync("app/globals.css", "utf8"), /html:has\(\.driver-portal\.ops-app\)/);
  assert.match(access, /defaultAuthorityId/);
  const session = readFileSync("lib/driver-portal/constants.ts", "utf8");
  assert.match(session, /60 \* 60 \* 24 \* 30/);
  const nav = readFileSync("components/driver-portal/driver-portal-nav.tsx", "utf8");
  assert.match(nav, /jobsNav/);
  assert.match(nav, /\/driver\/uetds/);
});
