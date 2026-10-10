import assert from "node:assert/strict";
import test from "node:test";
import { gpsFleetItemKey } from "@/lib/gps/fleet";
import { firstPartnerTabPath, partnerHasTab, partnerTabForPath } from "@/lib/partner/access";

test("fleet keys keep mobile and device sources apart", () => {
  const id = "18decd4b-e651-4b8d-90b4-d94339b6367a";
  assert.notEqual(gpsFleetItemKey({ id, source: "mobile" }), gpsFleetItemKey({ id, source: "device" }));
  assert.equal(gpsFleetItemKey({ id, source: "mobile" }), `mobile:${id}`);
});

test("extra users only receive granted tabs", () => {
  const member = { isOwner: false, tabs: ["drivers", "gps"] };
  assert.equal(partnerHasTab(member, "drivers"), true);
  assert.equal(partnerHasTab(member, "vehicles"), false);
  assert.equal(partnerHasTab({ isOwner: true, tabs: [] }, "users"), true);
  assert.equal(partnerTabForPath("/partner/users/1"), "users");
  assert.equal(firstPartnerTabPath(member), "/partner/drivers");
});
