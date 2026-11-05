import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { kamuLoginOwnerFromActors } from "@/lib/uetds/kamu-login-owner";

const partner = { partnerId: "partner", userId: "user", uetds: true };
const ops = { id: "ops", uetdsManage: true };
const driver = { partnerId: "partner", driverId: "driver", uetdsList: true };

test("driver Kamu login uses the driver session only when U-ETDS list access exists", () => {
  assert.equal(kamuLoginOwnerFromActors({ partner: null, ops: null, driver }), "driver:partner:driver");
  assert.equal(kamuLoginOwnerFromActors({
    partner: null,
    ops: null,
    driver: { ...driver, uetdsList: false },
  }), null);
  assert.equal(kamuLoginOwnerFromActors({ partner, ops: null, driver }), "partner:partner:user");
  assert.equal(kamuLoginOwnerFromActors({ partner: { ...partner, uetds: false }, ops, driver }), "ops:ops");
  assert.equal(kamuLoginOwnerFromActors({ partner: null, ops: null, driver: null }), null);
});

test("driver and partner Kamu frames share one owner gate", () => {
  const actions = readFileSync(new URL("./kamu-login-actions.ts", import.meta.url), "utf8");
  const frame = readFileSync(new URL("../../app/api/uetds/login-frame/route.ts", import.meta.url), "utf8");
  const access = readFileSync(new URL("./kamu-login-access.ts", import.meta.url), "utf8");
  assert.match(actions, /kamuLoginOwnerKey\(\)/);
  assert.match(actions, /loadKamuLoginNotification\(owner/);
  assert.match(actions, /driverMayUseKamuAuthority/);
  assert.match(actions, /default_edevlet_authority_id|driverMayUseKamuAuthority/);
  assert.match(frame, /kamuLoginOwnerKey\(\)/);
  assert.doesNotMatch(frame, /getPartnerActor|getDriverPortalActor/);
  assert.match(access, /driverUetdsScope/);
  assert.match(access, /permissions\.uetdsList/);
  assert.match(access, /partnerHasTab\(partner, "uetds"\)/);
  assert.match(access, /a\.id = d\.default_edevlet_authority_id/);
  assert.doesNotMatch(actions, /getUetdsNotification\(\s*\{\s*id: input\.notificationId\s*\}\s*\)/);
});
