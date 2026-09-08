import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BUS_CODE,
  BUSINESS_MINIVAN_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MIDIBUS_CODE,
  MINIBUS_CODE,
  PREMIUM_ECONOMY_SEDAN_CODE,
  STANDARD_MINIVAN_CODE,
} from "@/lib/booking/pricing/vehicle-quote";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import {
  isPartnerVehicleCatalogPair,
  PARTNER_VEHICLE_CATALOG,
  partnerVehicleCatalogLabels,
} from "@/lib/partner/vehicle-catalog";
import {
  initialVehicleStatusForClass,
  PARTNER_VEHICLE_CLASS_CODES,
  partnerVehicleClassLabel,
  vehicleClassRequiresApproval,
} from "@/lib/partner/vehicle-class";
import {
  nextPartnerVehicleStatus,
  normalizePartnerPlate,
  parsePartnerVehicleInput,
  partnerCreateVehicleStatus,
  partnerVehicleYearBounds,
  partnerVehicleYearOptions,
} from "@/lib/partner/vehicle-policy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    plate: " 34 abc 123 ",
    brandCode: "mercedes-benz",
    modelCode: "vito",
    modelYear: "2024",
    colorCode: "black",
    colorOther: "",
    passengerCapacity: "7",
    luggageCapacity: "7",
    vehicleClassCode: STANDARD_MINIVAN_CODE,
    featureCodes: ["ac", "wifi"],
    featureOther: "",
    now: new Date("2026-09-07T00:00:00.000Z"),
    ...overrides,
  };
}

test("model year window is current year minus 15, newest first", () => {
  assert.deepEqual(partnerVehicleYearBounds(new Date("2026-03-01")), {
    minYear: 2011,
    maxYear: 2026,
  });
  assert.deepEqual(partnerVehicleYearBounds(new Date("2027-01-01")), {
    minYear: 2012,
    maxYear: 2027,
  });
  const years = partnerVehicleYearOptions(new Date("2026-09-07"));
  assert.equal(years[0], 2026);
  assert.equal(years.at(-1), 2011);
  assert.equal(years.length, 16);
});

test("plate normalize trims and collapses spaces without inventing a format", () => {
  assert.equal(normalizePartnerPlate("  34 abc  123 "), "34 ABC 123");
  assert.equal(normalizePartnerPlate("34ABC123"), "34ABC123");
});

test("catalog is a single expandable source with real transfer models", () => {
  const brands = PARTNER_VEHICLE_CATALOG.map((item) => item.code);
  for (const code of [
    "mercedes-benz",
    "volkswagen",
    "ford",
    "renault",
    "fiat",
    "toyota",
    "peugeot",
    "citroen",
    "opel",
    "hyundai",
    "kia",
    "skoda",
    "audi",
    "bmw",
    "isuzu",
    "iveco",
    "man",
    "temsa",
    "otokar",
    "karsan",
  ]) {
    assert.equal(brands.includes(code), true, code);
  }
  assert.equal(isPartnerVehicleCatalogPair("mercedes-benz", "vito"), true);
  assert.equal(isPartnerVehicleCatalogPair("mercedes-benz", "sprinter"), true);
  assert.equal(isPartnerVehicleCatalogPair("mercedes-benz", "v-class"), true);
  assert.equal(isPartnerVehicleCatalogPair("volkswagen", "caravelle"), true);
  assert.equal(isPartnerVehicleCatalogPair("isuzu", "turkuaz"), true);
  assert.equal(isPartnerVehicleCatalogPair("mercedes-benz", "made-up"), false);
  assert.deepEqual(partnerVehicleCatalogLabels("volkswagen", "caravelle"), {
    brand: "Volkswagen",
    model: "Caravelle",
  });
  assert.doesNotMatch(source("components/partner/vehicle-fields.tsx"), /Mercedes-Benz|Caravelle|Turkuaz/);
});

test("vehicle classes reuse booking codes and never invent Economic Sedan", () => {
  assert.deepEqual(PARTNER_VEHICLE_CLASS_CODES, [
    PREMIUM_ECONOMY_SEDAN_CODE,
    STANDARD_MINIVAN_CODE,
    BUSINESS_MINIVAN_CODE,
    FIRST_CLASS_MINIVAN_CODE,
    FIRST_CLASS_SEDAN_CODE,
    MINIBUS_CODE,
    MIDIBUS_CODE,
    BUS_CODE,
  ]);
  assert.equal(vehicleClassRequiresApproval(STANDARD_MINIVAN_CODE), false);
  assert.equal(vehicleClassRequiresApproval(MINIBUS_CODE), false);
  assert.equal(vehicleClassRequiresApproval(BUSINESS_MINIVAN_CODE), true);
  assert.equal(vehicleClassRequiresApproval(FIRST_CLASS_MINIVAN_CODE), true);
  assert.equal(vehicleClassRequiresApproval(FIRST_CLASS_SEDAN_CODE), true);
  assert.equal(initialVehicleStatusForClass(STANDARD_MINIVAN_CODE), "active");
  assert.equal(initialVehicleStatusForClass(FIRST_CLASS_SEDAN_CODE), "pending_approval");
  assert.equal(partnerCreateVehicleStatus(PREMIUM_ECONOMY_SEDAN_CODE), "active");
  assert.equal(partnerVehicleClassLabel(PREMIUM_ECONOMY_SEDAN_CODE, "tr"), vehicleCardCopyFor(PREMIUM_ECONOMY_SEDAN_CODE, "tr").title);
  assert.doesNotMatch(source("lib/partner/vehicle-class.ts"), /economic-sedan|Economic Sedan/);
  assert.doesNotMatch(source("db/migrations/038_partner_vehicles.sql"), /economic-sedan/);
});

test("partner cannot bypass approval by later changing into a premium class", () => {
  assert.equal(
    nextPartnerVehicleStatus({
      nextClassCode: FIRST_CLASS_MINIVAN_CODE,
      currentStatus: "active",
      currentClassCode: STANDARD_MINIVAN_CODE,
      source: "partner",
    }),
    "pending_approval",
  );
  assert.equal(
    nextPartnerVehicleStatus({
      nextClassCode: STANDARD_MINIVAN_CODE,
      currentStatus: "pending_approval",
      currentClassCode: FIRST_CLASS_MINIVAN_CODE,
      source: "partner",
    }),
    "active",
  );
  assert.equal(
    nextPartnerVehicleStatus({
      nextClassCode: FIRST_CLASS_SEDAN_CODE,
      currentStatus: "rejected",
      currentClassCode: FIRST_CLASS_SEDAN_CODE,
      source: "partner",
    }),
    "pending_approval",
  );
  assert.equal(
    nextPartnerVehicleStatus({
      nextClassCode: FIRST_CLASS_SEDAN_CODE,
      currentStatus: "active",
      currentClassCode: FIRST_CLASS_SEDAN_CODE,
      source: "partner",
    }),
    "active",
  );
});

test("parsePartnerVehicleInput keeps structured values and rejects stale years", () => {
  const parsed = parsePartnerVehicleInput(validInput());
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.plate, "34 ABC 123");
    assert.equal(parsed.value.brand, "Mercedes-Benz");
    assert.equal(parsed.value.model, "Vito");
    assert.equal(parsed.value.modelYear, 2024);
    assert.equal(parsed.value.passengerCapacity, 7);
    assert.equal(parsed.value.luggageCapacity, 7);
  }
  const stale = parsePartnerVehicleInput(validInput({ modelYear: "2010" }));
  assert.equal(stale.ok, false);
  if (!stale.ok) {
    assert.equal(stale.error, "invalid-year");
  }
  const future = parsePartnerVehicleInput(validInput({ modelYear: "2027" }));
  assert.equal(future.ok, false);
});
