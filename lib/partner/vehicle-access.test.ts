import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = read("db/migrations/112_vehicle_partner_access.sql");
const driverMigration = read("db/migrations/113_driver_vehicle_derived_visibility.sql");
const notificationMigration = read("db/migrations/115_shared_vehicle_uetds_access.sql");
const multipleDrivers = read("db/migrations/116_vehicle_multiple_drivers.sql");
const oneVehiclePerDriver = read("db/migrations/117_one_vehicle_per_driver.sql");
const fleet = read("lib/partner/fleet.ts");
const gps = read("lib/gps/queries.ts");
const immobilizer = read("lib/teltonika/immobilizer-store.ts");
const uetds = read("lib/uetds/fleet-scope.ts");
const notifications = read("lib/uetds/notifications.ts");
const permissionStore = read("lib/partner/driver-permission-store.ts");
const permissionAction = read("lib/partner/driver-permissions.ts");

test("vehicle access migration backfills legacy ownership and protects the final grant", () => {
  assert.match(migration, /CREATE TABLE partner_vehicle_access/);
  assert.match(migration, /SELECT id, partner_id, uetds_company_id\s+FROM partner_vehicles/);
  assert.match(migration, /partner_vehicle_access_keep_one/);
  assert.match(migration, /ERRCODE = '23514'/);
  assert.match(migration, /CREATE TABLE partner_vehicle_access_audit/);
});

test("vehicle creation atomically creates its initial equal access grant", () => {
  assert.match(fleet, /WITH created AS[\s\S]*INSERT INTO partner_vehicle_access/);
  assert.match(fleet, /INSERT INTO partner_vehicle_access_audit/);
  assert.match(fleet, /partner_can_access_vehicle/);
  assert.match(fleet, /partner_can_access_driver/);
});

test("an owning partner still sees an unpaired driver and one vehicle can hold many drivers", () => {
  assert.match(multipleDrivers, /PRIMARY KEY \(driver_id, vehicle_id\)/);
  assert.match(multipleDrivers, /driver\.partner_id = requested_partner_id/);
  assert.match(multipleDrivers, /JOIN partner_vehicle_access access/);
  assert.doesNotMatch(multipleDrivers, /DELETE FROM partner_drivers/);
  assert.doesNotMatch(multipleDrivers, /UPDATE partner_drivers/);
  assert.doesNotMatch(multipleDrivers, /INSERT INTO partner_fleet_defaults/);
  assert.doesNotMatch(multipleDrivers, /INSERT INTO uetds_notifications/);
});

test("a driver cannot be stored on two vehicles and existing rows are not deleted", () => {
  assert.match(oneVehiclePerDriver, /CREATE UNIQUE INDEX partner_fleet_defaults_one_vehicle_per_driver/);
  assert.match(oneVehiclePerDriver, /ON partner_fleet_defaults \(driver_id\)/);
  assert.match(oneVehiclePerDriver, /HAVING count\(\*\) > 1/);
  assert.doesNotMatch(oneVehiclePerDriver, /DELETE FROM partner_fleet_defaults/);
  assert.doesNotMatch(oneVehiclePerDriver, /DELETE FROM partner_drivers/);
  assert.doesNotMatch(oneVehiclePerDriver, /UPDATE partner_drivers/);
});

test("a formerly paired driver does not reappear through creator provenance", () => {
  assert.match(driverMigration, /vehicle_derived_visibility BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(driverMigration, /driver\.vehicle_derived_visibility = FALSE/);
  assert.match(driverMigration, /JOIN partner_vehicle_access access/);
});

test("GPS, immobilizer and U-ETDS partner paths use shared access", () => {
  assert.match(gps, /partner_can_access_gps_device/);
  assert.match(gps, /partner_can_access_vehicle/);
  assert.match(immobilizer, /partner_can_access_gps_device/);
  assert.match(uetds, /partner_vehicle_access access/);
  assert.match(uetds, /partner_can_access_driver/);
  assert.match(uetds, /partner_can_access_vehicle/);
});

test("authorization migration does not create subscriptions or ATS submissions", () => {
  assert.doesNotMatch(migration, /INSERT INTO partner_vehicle_uetds_subscription_periods/);
  assert.doesNotMatch(migration, /INSERT INTO gps_ats_submissions/);
});

test("one shared U-ETDS record is visible through current vehicle grants", () => {
  assert.match(notificationMigration, /partner_can_access_uetds_notification/);
  assert.match(notificationMigration, /notification\.partner_id = requested_partner_id/);
  assert.match(notificationMigration, /partner_can_access_vehicle/);
  assert.match(notifications, /partner_can_access_uetds_notification/);
  assert.doesNotMatch(notificationMigration, /INSERT INTO uetds_notifications/);
});

test("shared partners read and update one driver permission document", () => {
  assert.match(permissionStore, /partner_can_access_driver/);
  assert.match(permissionAction, /partner_can_access_driver/);
  assert.match(permissionAction, /SET portal_permissions = \$3::jsonb/);
  assert.doesNotMatch(permissionAction, /INSERT INTO/);
});

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}
