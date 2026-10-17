import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { physicalAtsSubscriptionAllows, planVehicleSubscriptionMove } from "@/lib/uetds/vehicle-subscription-plan";

const base = {
  deleted: false,
  vehicleDeleted: false,
  standardEnabled: true,
  advancedEnabled: false,
  mobileEnabled: true,
  enrolled: true,
};

test("a default vehicle receives the driver subscription once", () => {
  const plan = planVehicleSubscriptionMove([
    { ...base, driverId: "d1", vehicleId: "v1" },
    { ...base, driverId: "d2", vehicleId: null, mobileEnabled: true },
  ]);
  assert.deepEqual(plan.moves, [{ driverId: "d1", vehicleId: "v1" }]);
  assert.equal(plan.unmatched.length, 1);
  assert.equal(plan.unmatched[0]?.driverId, "d2");
});

test("two drivers on one vehicle are not assigned at random", () => {
  const plan = planVehicleSubscriptionMove([
    { ...base, driverId: "d1", vehicleId: "v1" },
    { ...base, driverId: "d2", vehicleId: "v1" },
  ]);
  assert.deepEqual(plan.moves, []);
  assert.equal(plan.unmatched.length, 2);
});

test("changing the driver does not move a vehicle subscription", () => {
  const first = planVehicleSubscriptionMove([{ ...base, driverId: "d1", vehicleId: "v1" }]);
  const second = planVehicleSubscriptionMove([{ ...base, driverId: "d2", vehicleId: "v1", mobileEnabled: false, standardEnabled: false, enrolled: false }]);
  assert.deepEqual(first.moves, [{ driverId: "d1", vehicleId: "v1" }]);
  assert.deepEqual(second.moves, []);
});

test("physical ATS keeps the device rule and adds the vehicle GPS-ATS flag", () => {
  const device = { deviceActive: true, liveSource: true, assignedToVehicle: true, explicitlyDisabled: false };
  assert.equal(physicalAtsSubscriptionAllows({ ...device, gpsAtsEnabled: true }), true);
  assert.equal(physicalAtsSubscriptionAllows({ ...device, gpsAtsEnabled: false }), false);
  assert.equal(physicalAtsSubscriptionAllows({ ...device, gpsAtsEnabled: true, explicitlyDisabled: true }), false);
  const migration = readFileSync(new URL("../../db/migrations/099_vehicle_subscriptions.sql", import.meta.url), "utf8");
  assert.match(migration, /34egp847/);
  assert.match(migration, /ON CONFLICT \(vehicle_id, period_year, period_month\) DO NOTHING/);
  assert.doesNotMatch(migration, /UPDATE partner_drivers/);
  const physical = readFileSync(new URL("../gps/ats-run.ts", import.meta.url), "utf8");
  const mobile = readFileSync(new URL("../gps/ats-mobile-dispatch.ts", import.meta.url), "utf8");
  assert.match(physical, /vehicle\.service_gps_ats_enabled/);
  assert.match(physical, /ATS_PERIOD_MS|120_000|period_slot/);
  assert.match(mobile, /vehicle\.service_mobile_gps_enabled/);
  assert.match(mobile, /getVehicleUetdsSubscription/);
  assert.doesNotMatch(mobile, /getDriverUetdsSubscription/);
  assert.match(mobile, /ats_ministry_source/);
  assert.doesNotMatch(mobile, /physical_live/);
});
