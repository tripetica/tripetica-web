import assert from "node:assert/strict";
import test from "node:test";
import { assignedGpsItems } from "@/lib/driver-portal/gps-filter";
import {
  driverGpsPermissionKeys,
  driverHasGpsAccess,
  driverHasUetdsAccess,
  driverPermissionGroupState,
  driverUetdsPermissionKeys,
  emptyDriverPermissions,
  parseDriverPermissions,
  setDriverPermissionGroup,
} from "@/lib/driver-portal/permissions";

test("missing and unknown permission keys stay off", () => {
  assert.deepEqual(parseDriverPermissions(null), emptyDriverPermissions());
  assert.deepEqual(parseDriverPermissions({ gpsLive: true, extra: true, gpsDevice: "yes" }), {
    ...emptyDriverPermissions(),
    gpsLive: true,
  });
});

test("driver GPS lists keep only the assigned vehicle", () => {
  const vehicles = [
    { id: "device-a", vehicleId: "vehicle-a", plate: "34AN9626" },
    { id: "device-b", vehicleId: "vehicle-b", plate: "34ZZ000" },
    { id: "loose", vehicleId: null, plate: null },
  ];
  assert.deepEqual(assignedGpsItems(vehicles, ["vehicle-a"]).map((item) => item.id), ["device-a"]);
  assert.deepEqual(assignedGpsItems(vehicles, []), []);
});

test("a closed section stays out of the portal menu", () => {
  const permissions = emptyDriverPermissions();
  assert.equal(driverHasGpsAccess(permissions), false);
  assert.equal(driverHasUetdsAccess({ ...permissions, uetdsList: true }), true);
  assert.equal(driverHasGpsAccess({ ...permissions, gpsDevice: true }), true);
});

test("a main permission box selects and clears every child", () => {
  const cleared = setDriverPermissionGroup(emptyDriverPermissions(), driverGpsPermissionKeys, true);
  assert.equal(driverPermissionGroupState(cleared, driverGpsPermissionKeys), "all");
  assert.equal(driverPermissionGroupState(setDriverPermissionGroup(cleared, driverGpsPermissionKeys, false), driverGpsPermissionKeys), "none");
  const partial = { ...emptyDriverPermissions(), uetdsNew: true };
  assert.equal(driverPermissionGroupState(partial, driverUetdsPermissionKeys), "some");
});
