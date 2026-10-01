import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  allowedAuthorityIds,
  applyDriverVehicleDefault,
  authoritiesForCompany,
  authorityForDriverChange,
  authorityForNotificationForm,
  companyChoicesForRow,
  fleetChoicesForPartner,
  initialVehicleForSelectedDriver,
  showGoldAuthorityField,
} from "./fleet-pairing-rules";

const driver = "33333333-3333-4333-8333-333333333333";
const otherDriver = "44444444-4444-4444-8444-444444444444";
const vehicleA = "66666666-6666-4666-8666-666666666666";
const vehicleB = "77777777-7777-4777-8777-777777777777";
const authority = "99999999-9999-4999-8999-999999999999";
const otherAuthority = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const company = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("driver selection fills the linked vehicle and leaves a later manual vehicle in place", () => {
  const vehicles = [vehicleA, vehicleB];
  const filled = applyDriverVehicleDefault(
    { driverId: "", vehicleId: "", note: "kept" },
    driver,
    vehicleA,
    vehicles,
  );
  assert.deepEqual(filled, { driverId: driver, vehicleId: vehicleA, note: "kept" });

  const manual = { ...filled, vehicleId: vehicleB };
  const sameDriver = applyDriverVehicleDefault(manual, driver, vehicleA, vehicles);
  assert.equal(sameDriver, manual);

  const switched = applyDriverVehicleDefault(manual, otherDriver, null, vehicles);
  assert.equal(switched.vehicleId, vehicleB);
  assert.equal(switched.driverId, otherDriver);

  const missingDefault = applyDriverVehicleDefault(
    { driverId: "", vehicleId: vehicleB },
    driver,
    "not-in-list",
    vehicles,
  );
  assert.equal(missingDefault.vehicleId, vehicleB);

  const opened = initialVehicleForSelectedDriver(
    { driverId: driver, vehicleId: vehicleB },
    "",
    vehicleA,
    vehicles,
  );
  assert.equal(opened.vehicleId, vehicleA);
  const reserved = initialVehicleForSelectedDriver(
    { driverId: driver, vehicleId: vehicleB },
    vehicleB,
    vehicleA,
    vehicles,
  );
  assert.equal(reserved.vehicleId, vehicleB);
});

test("gold edit fills the linked authority and a manual choice stays until the driver changes", () => {
  assert.equal(showGoldAuthorityField("gold"), true);
  assert.equal(showGoldAuthorityField("standard"), false);

  const first = authorityForDriverChange({
    previousDriverId: "",
    nextDriverId: driver,
    currentAuthorityId: "",
    membershipStatus: "gold",
    defaultAuthorityId: authority,
    allowedAuthorityIds: [authority],
  });
  assert.equal(first, authority);

  const manual = authorityForDriverChange({
    previousDriverId: driver,
    nextDriverId: driver,
    currentAuthorityId: otherAuthority,
    membershipStatus: "gold",
    defaultAuthorityId: authority,
    allowedAuthorityIds: [authority, otherAuthority],
  });
  assert.equal(manual, otherAuthority);

  const nextDriver = authorityForDriverChange({
    previousDriverId: driver,
    nextDriverId: otherDriver,
    currentAuthorityId: otherAuthority,
    membershipStatus: "gold",
    defaultAuthorityId: null,
    allowedAuthorityIds: [authority],
  });
  assert.equal(nextDriver, "");

  const standard = authorityForDriverChange({
    previousDriverId: "",
    nextDriverId: driver,
    currentAuthorityId: "",
    membershipStatus: "standard",
    defaultAuthorityId: authority,
    allowedAuthorityIds: [authority],
  });
  assert.equal(standard, "");
});

test("notification form autofills an active linked authority for any membership and keeps another partner out", () => {
  const gold = authorityForNotificationForm({
    previousDriverId: "",
    nextDriverId: driver,
    currentAuthorityId: "",
    defaultAuthorityId: authority,
    allowedAuthorityIds: [authority],
  });
  assert.equal(gold, authority);
  const standard = authorityForNotificationForm({
    previousDriverId: "",
    nextDriverId: driver,
    currentAuthorityId: "",
    defaultAuthorityId: authority,
    allowedAuthorityIds: [authority],
  });
  assert.equal(standard, authority);
  const missing = authorityForNotificationForm({
    previousDriverId: "",
    nextDriverId: driver,
    currentAuthorityId: "",
    defaultAuthorityId: null,
    allowedAuthorityIds: [],
  });
  assert.equal(missing, "");
  const foreign = authorityForNotificationForm({
    previousDriverId: "",
    nextDriverId: driver,
    currentAuthorityId: "",
    defaultAuthorityId: otherAuthority,
    allowedAuthorityIds: [authority],
  });
  assert.equal(foreign, "");
  const kept = authorityForNotificationForm({
    previousDriverId: driver,
    nextDriverId: driver,
    currentAuthorityId: authority,
    defaultAuthorityId: otherAuthority,
    allowedAuthorityIds: [authority],
  });
  assert.equal(kept, authority);
});

test("authority choices follow the driver company when one is set", () => {
  const authorities = [
    { id: authority, partnerId: "p1", label: "A", companyIds: [company] },
    { id: otherAuthority, partnerId: "p1", label: "B", companyIds: ["other"] },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", partnerId: "p2", label: "C", companyIds: [company] },
  ];
  assert.deepEqual(
    allowedAuthorityIds({ partnerId: "p1", uetdsCompanyId: company }, authorities),
    [authority],
  );
  assert.deepEqual(
    allowedAuthorityIds({ partnerId: "p1", uetdsCompanyId: null }, authorities).sort(),
    [authority, otherAuthority].sort(),
  );
  assert.deepEqual(authoritiesForCompany(authorities, ""), authorities);
  assert.deepEqual(
    authoritiesForCompany(
      [{ id: authority, partnerId: "p1", label: "A", companyIds: [] as string[] }],
      company,
    ),
    [],
  );
});

test("forms autofill an optional authority on the notification form and keep SOAP edit gold-only", () => {
  const notification = readFileSync("components/uetds/uetds-notification-form.tsx", "utf8");
  const edit = readFileSync("components/uetds/uetds-notification-edit-form.tsx", "utf8");
  const driverCard = readFileSync("components/partner/driver-detail.tsx", "utf8");
  const vehicleCard = readFileSync("components/partner/vehicle-detail.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  const migration = readFileSync("db/migrations/067_partner_fleet_defaults.sql", "utf8");
  const ops = readFileSync("lib/ops/partner-fleet-actions.ts", "utf8");

  assert.match(notification, /applyDriverVehicleDefault/);
  assert.match(notification, /updateTrip\("vehicleId"/);
  assert.match(notification, /authorityForNotificationForm/);
  assert.match(notification, /edevletAuthorityOptional/);
  assert.doesNotMatch(notification, /name="edevletAuthorityId"/);
  assert.doesNotMatch(notification, /unsealSecret/);
  assert.match(edit, /showGoldAuthorityField/);
  assert.match(edit, /authorityForDriverChange/);
  assert.match(edit, /onChange=\{setAuthorityId\}/);
  assert.doesNotMatch(edit, /name="edevletAuthorityId"/);
  assert.match(driverCard, /name="defaultVehicleId"/);
  assert.match(driverCard, /name="defaultAuthorityId"/);
  assert.match(vehicleCard, /name="defaultDriverId"/);
  assert.match(css, /\.partner-fleet-form[\s\S]*padding-bottom:\s*1\.25rem/);
  assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*\.partner-fleet-form \{[\s\S]*padding-bottom:\s*6rem/);
  assert.match(migration, /PRIMARY KEY \(driver_id\)/);
  assert.match(migration, /UNIQUE \(vehicle_id\)/);
  assert.match(migration, /default_edevlet_authority_id/);
  assert.doesNotMatch(migration, /INSERT INTO partner_fleet_defaults/);
  assert.doesNotMatch(migration, /UPDATE partner_drivers/);
  assert.doesNotMatch(ops, /defaultVehicleId|defaultAuthorityId|defaultDriverId/);
});

test("inline lists keep one partner scope and the pairing table as the only link", () => {
  const partnerDrivers = readFileSync("components/partner/driver-list.tsx", "utf8");
  const partnerVehicles = readFileSync("components/partner/vehicle-list.tsx", "utf8");
  const opsDrivers = readFileSync("components/ops/driver-table.tsx", "utf8");
  const opsVehicles = readFileSync("components/ops/vehicle-table.tsx", "utf8");
  const patch = readFileSync("lib/partner/fleet-list-patch.ts", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  const choices = {
    p1: {
      vehicles: [{ id: vehicleA, label: "34 A" }],
      drivers: [{ id: driver, label: "A" }],
      authorities: [{ id: authority, partnerId: "p1", label: "Auth", companyIds: [company] }],
    },
    p2: {
      vehicles: [{ id: vehicleB, label: "06 B" }],
      drivers: [{ id: otherDriver, label: "B" }],
      authorities: [{ id: otherAuthority, partnerId: "p2", label: "Other", companyIds: [company] }],
    },
  };

  assert.deepEqual(fleetChoicesForPartner(choices, "p1").vehicles, [{ id: vehicleA, label: "34 A" }]);
  assert.deepEqual(fleetChoicesForPartner(choices, "missing"), {
    vehicles: [],
    drivers: [],
    authorities: [],
  });
  assert.deepEqual(
    authoritiesForCompany(fleetChoicesForPartner(choices, "p1").authorities, company).map((item) => item.id),
    [authority],
  );
  assert.deepEqual(companyChoicesForRow([{ id: company, shortName: "SEARCH" }], null), [
    { id: company, label: "SEARCH" },
  ]);

  for (const source of [partnerDrivers, opsDrivers]) {
    assert.match(source, /fleetChoicesForPartner\(fleetChoices, driver\.partnerId\)/);
    assert.match(source, /authoritiesForCompany\(/);
    assert.match(source, /\/drivers\/\$\{driver\.id\}/);
  }
  for (const source of [partnerVehicles, opsVehicles]) {
    assert.match(source, /fleetChoicesForPartner\(fleetChoices, vehicle\.partnerId\)/);
    assert.doesNotMatch(source, /defaultEdevletAuthority|patch\w*Authority/);
    assert.match(source, /\/vehicles\/\$\{vehicle\.id\}/);
  }
  assert.match(patch, /partner_fleet_defaults/);
  assert.match(patch, /saveDriverVehiclePair/);
  assert.match(patch, /saveVehicleDriverPair/);
  assert.match(patch, /default_edevlet_authority_id = NULL/);
  assert.doesNotMatch(patch, /default_vehicle_id|default_driver_id/);
  assert.match(css, /\.edevlet-company-options \.ops-check input\[type="checkbox"\][\s\S]*width:\s*1rem/);
  assert.match(css, /\.edevlet-company-options \.ops-check[\s\S]*gap:\s*0\.4rem/);
});
