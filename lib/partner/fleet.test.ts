import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isPartnerFleetAssignable,
  partnerDriverFullName,
  partnerVehicleBrandModel,
} from "@/lib/partner/fleet-view";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("fleet view helpers stay browser-safe and assignment-ready", () => {
  const view = source("lib/partner/fleet-view.ts");
  assert.doesNotMatch(view, /server-only|postgres|getPool/);
  assert.equal(partnerDriverFullName("Ahmet", "Yılmaz"), "Ahmet Yılmaz");
  assert.equal(
    partnerVehicleBrandModel({ brand: "Mercedes", model: "Vito" }),
    "Mercedes / Vito",
  );
  assert.equal(true, isPartnerFleetAssignable({ status: "active", deletedAt: null }));
  assert.equal(false, isPartnerFleetAssignable({ status: "inactive", deletedAt: null }));
  assert.equal(false, isPartnerFleetAssignable({ status: "active", deletedAt: "2026-01-01" }));
});

test("fleet migration is additive and does not rewrite booking or partner auth", () => {
  const sql = source("db/migrations/035_partner_fleet.sql");
  assert.match(sql, /CREATE TABLE partner_drivers/);
  assert.match(sql, /CREATE TABLE partner_vehicles/);
  assert.match(sql, /deleted_at/);
  assert.match(sql, /status = 'active'/);
  assert.doesNotMatch(sql, /ALTER TABLE reservations/);
  assert.doesNotMatch(sql, /ALTER TABLE partners/);
  assert.doesNotMatch(sql, /DROP TABLE/);
  assert.doesNotMatch(sql, /INSERT INTO partners/);
  assert.doesNotMatch(sql, /UPDATE partners SET/);
  assert.doesNotMatch(sql, /PTR-0002/);
});

test("ops fleet actions never mutate partner status and keep entity routes separate", () => {
  const actions = source("lib/ops/partner-fleet-actions.ts");
  const driversPage = source(
    "app/[locale]/ops/(panel)/partners/[id]/drivers/[driverId]/page.tsx",
  );
  const vehiclesPage = source(
    "app/[locale]/ops/(panel)/partners/[id]/vehicles/[vehicleId]/page.tsx",
  );
  const partnerForm = source("components/ops/partner-info-form.tsx");
  const driverForm = source("components/ops/partner-driver-form.tsx");
  const vehicleForm = source("components/ops/partner-vehicle-form.tsx");
  assert.match(actions, /updatePartnerDriver/);
  assert.match(actions, /updatePartnerVehicle/);
  assert.doesNotMatch(actions, /activateOpsPartner\b|updateOpsPartnerProfile/);
  assert.match(driversPage, /PartnerDriverForm/);
  assert.match(vehiclesPage, /PartnerVehicleForm/);
  assert.doesNotMatch(driversPage, /PartnerInfoForm/);
  assert.doesNotMatch(vehiclesPage, /PartnerInfoForm/);
  assert.match(partnerForm, /ops-partner-sticky/);
  assert.match(partnerForm, /copy\.back/);
  assert.match(partnerForm, /PartnerFleetTable/);
  assert.match(driverForm, /updateOpsPartnerDriverAction/);
  assert.match(vehicleForm, /updateOpsPartnerVehicleAction/);
  assert.doesNotMatch(driverForm, /updateOpsPartnerAction/);
  assert.doesNotMatch(vehicleForm, /updateOpsPartnerAction/);
  assert.doesNotMatch(partnerForm, /updateOpsPartnerDriverAction/);
});

test("partner and ops driver screens share partner_drivers and ops cannot create", () => {
  assert.doesNotMatch(source("lib/partner/session.ts"), /priority_level/);
  assert.doesNotMatch(source("components/partner/profile-form.tsx"), /priority/i);
  assert.match(source("app/[locale]/partner/(panel)/drivers/page.tsx"), /listPartnerDrivers/);
  assert.doesNotMatch(source("app/[locale]/partner/(panel)/drivers/page.tsx"), /PartnerComingSoon/);
  assert.match(source("app/[locale]/partner/(panel)/vehicles/page.tsx"), /listPartnerVehicles/);
  assert.doesNotMatch(source("app/[locale]/partner/(panel)/vehicles/page.tsx"), /PartnerComingSoon/);
  assert.match(source("app/[locale]/partner/(panel)/jobs/page.tsx"), /listOpenPartnerJobs/);
  assert.doesNotMatch(source("app/[locale]/partner/(panel)/jobs/page.tsx"), /PartnerComingSoon/);
  assert.match(source("app/[locale]/partner/(panel)/accepted/page.tsx"), /listAcceptedPartnerJobs/);
  assert.doesNotMatch(source("app/[locale]/partner/(panel)/accepted/page.tsx"), /PartnerComingSoon/);
  assert.match(source("lib/partner/driver-actions.ts"), /createPartnerDriver/);
  assert.match(source("lib/partner/driver-actions.ts"), /actor\.partnerId/);
  assert.match(source("lib/partner/driver-actions.ts"), /\/partner\/drivers\?added=1/);
  assert.doesNotMatch(
    source("lib/partner/driver-actions.ts"),
    /\/partner\/drivers\/\$\{result\.driverId\}/,
  );
  const list = source("components/partner/driver-list.tsx");
  assert.match(list, /filterAndSortPartnerDrivers/);
  assert.match(list, /driverSearchPlaceholder/);
  assert.match(list, /type="search"/);
  assert.doesNotMatch(list, /Filtrele|type="submit"/);
  assert.equal((list.match(/ops-sort-link/g) ?? []).length, 1);
  assert.match(list, /copy\.driverFullName/);
  assert.match(list, /copy\.driverEmail/);
  assert.match(list, /driver\.email\?\.trim\(\) \|\| "—"/);
  assert.ok(list.indexOf("copy.phoneNumber") < list.indexOf("copy.driverEmail"));
  assert.ok(list.indexOf("copy.driverEmail") < list.indexOf("copy.driverLanguages"));
  assert.ok(list.indexOf("formatPartnerFleetPhone(driver.phone)") < list.indexOf('driver.email?.trim() || "—"'));
  assert.ok(
    list.indexOf('driver.email?.trim() || "—"') <
      list.indexOf("formatPartnerDriverLanguages(driver.languageCodes, locale)"),
  );
  assert.ok(list.indexOf("copy.driverLanguages") < list.indexOf("copy.uetdsCompanyColumn"));
  assert.ok(list.indexOf("copy.uetdsCompanyColumn") < list.indexOf("copy.driverStatus"));
  assert.match(list, /formatUetdsCompanyListLabel\(driver\.uetdsCompany/);
  const vehicleList = source("components/partner/vehicle-list.tsx");
  assert.ok(vehicleList.indexOf("copy.vehicleCapacity") < vehicleList.indexOf("copy.uetdsCompanyColumn"));
  assert.ok(vehicleList.indexOf("copy.uetdsCompanyColumn") < vehicleList.indexOf("copy.vehicleStatus"));
  assert.match(vehicleList, /formatUetdsCompanyListLabel\(vehicle\.uetdsCompany/);
  assert.doesNotMatch(source("lib/ops/partner-fleet-actions.ts"), /createPartnerDriver/);
  assert.doesNotMatch(source("components/ops/partner-info-form.tsx"), /addDriver|Sürücü Ekle/);
  assert.match(source("components/ops/partner-info-form.tsx"), /driverSearchPlaceholder/);
  assert.match(source("components/ops/partner-info-form.tsx"), /vehicleSearchPlaceholder/);
  assert.match(source("components/ops/partner-fleet-table.tsx"), /driver\.languageCodes/);
  assert.match(source("components/ops/partner-fleet-table.tsx"), /onNameSort/);
  const globalDrivers = source("app/[locale]/ops/(panel)/drivers/page.tsx");
  assert.match(globalDrivers, /listOpsDrivers/);
  assert.doesNotMatch(globalDrivers, /Sürücü Ekle|addDriver|createPartnerDriver/);
  assert.match(source("lib/ops/drivers.ts"), /FROM partner_drivers d/);
  assert.doesNotMatch(source("lib/ops/drivers.ts"), /CREATE TABLE/);
  const opsDrivers = source("components/ops/driver-table.tsx");
  assert.match(opsDrivers, /driver\.partnerName/);
  assert.doesNotMatch(opsDrivers, /nationalId|national_id/);
  assert.ok(opsDrivers.indexOf("copy.driverLanguages") < opsDrivers.indexOf("copy.uetdsCompanyColumn"));
  assert.ok(opsDrivers.indexOf("copy.uetdsCompanyColumn") < opsDrivers.indexOf("copy.status"));
  assert.match(source("lib/ops/drivers.ts"), /LEFT JOIN uetds_companies uc ON uc.id = d.uetds_company_id/);
  assert.doesNotMatch(source("lib/ops/drivers.ts"), /password_sealed|test_username|live_username/);
  assert.match(source("db/migrations/037_partner_driver_identity_languages.sql"), /ALTER TABLE partner_drivers/);
  assert.doesNotMatch(source("db/migrations/037_partner_driver_identity_languages.sql"), /CREATE TABLE partner_drivers/);
  assert.doesNotMatch(source("db/migrations/037_partner_driver_identity_languages.sql"), /ALTER TABLE reservations/);
  assert.match(source("lib/partner/vehicle-actions.ts"), /createPartnerVehicle/);
  assert.match(source("lib/partner/vehicle-actions.ts"), /actor\.partnerId/);
  assert.match(source("lib/partner/vehicle-actions.ts"), /\/partner\/vehicles\?added=1/);
  assert.doesNotMatch(source("lib/ops/partner-fleet-actions.ts"), /createPartnerVehicle/);
  assert.match(source("lib/ops/vehicles.ts"), /FROM partner_vehicles v/);
  assert.doesNotMatch(source("lib/ops/vehicles.ts"), /CREATE TABLE/);
  assert.match(source("app/[locale]/ops/(panel)/vehicles/page.tsx"), /listOpsVehicles/);
  assert.doesNotMatch(source("app/[locale]/ops/(panel)/vehicles/page.tsx"), /Araç Ekle|addVehicle|createPartnerVehicle/);
  const opsVehicles = source("components/ops/vehicle-table.tsx");
  assert.match(opsVehicles, /vehicle\.partnerName/);
  assert.ok(opsVehicles.indexOf("copy.vehicleCapacity") < opsVehicles.indexOf("copy.uetdsCompanyColumn"));
  assert.ok(opsVehicles.indexOf("copy.uetdsCompanyColumn") < opsVehicles.indexOf("copy.status"));
  assert.match(source("lib/ops/vehicles.ts"), /LEFT JOIN uetds_companies uc ON uc.id = v.uetds_company_id/);
  assert.doesNotMatch(source("lib/ops/vehicles.ts"), /password_sealed|test_username|live_username/);
  assert.match(source("db/migrations/038_partner_vehicles.sql"), /ALTER TABLE partner_vehicles/);
  assert.match(source("db/migrations/038_partner_vehicles.sql"), /partner_vehicles_plate_global_uidx/);
  assert.match(source("db/migrations/038_partner_vehicles.sql"), /partner_vehicle_approval_requested/);
  assert.doesNotMatch(source("db/migrations/038_partner_vehicles.sql"), /CREATE TABLE partner_vehicles/);
  assert.doesNotMatch(source("db/migrations/038_partner_vehicles.sql"), /ALTER TABLE reservations/);
  assert.doesNotMatch(source("db/migrations/038_partner_vehicles.sql"), /economic-sedan/);
  assert.match(source("db/migrations/046_driver_portal.sql"), /ADD COLUMN email TEXT/);
  assert.match(source("lib/partner/driver-actions.ts"), /email: String\(formData\.get\("email"/);
  assert.match(source("lib/ops/partner-fleet-actions.ts"), /email: String\(formData\.get\("email"/);
});
