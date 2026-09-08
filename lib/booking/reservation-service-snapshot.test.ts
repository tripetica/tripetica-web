import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReservationServiceSnapshot } from "@/lib/booking/reservation-service-snapshot";
import {
  BURSA_ROUTE_BRIDGE_ULUDAG,
  BURSA_ROUTE_FERRY,
} from "@/lib/booking/pricing/bursa-pricing";
import { STANDARD_MINIVAN_CODE } from "@/lib/booking/pricing/vehicle-quote";

test("hourly snapshot freezes package coverage and vehicle-adjusted tariffs", () => {
  const snapshot = buildReservationServiceSnapshot({
    serviceType: "hourly",
    tourCode: null,
    durationHours: 10,
    bursaRoute: null,
    vehicleCode: STANDARD_MINIVAN_CODE,
  });
  assert.equal(snapshot.locales.tr.packageCoverage, "10 saat / 110 km");
  assert.equal(
    snapshot.locales.tr.vehicleSubtitle,
    "Volkswagen Caravelle veya benzeri",
  );
  assert.equal(
    snapshot.locales.en.vehicleSubtitle,
    "Volkswagen Caravelle or similar",
  );
  assert.equal(
    snapshot.locales.ru.vehicleSubtitle,
    "Volkswagen Caravelle или аналог",
  );
  assert.deepEqual(snapshot.locales.tr.packageNotes, [
    "Süre aşımı: +16,50 EUR / saat",
    "Kilometre aşımı: +0,55 EUR / km",
    "Avrupa–Anadolu geçişi: +15 EUR",
  ]);
});

test("transfer snapshot freezes the localized vehicle subtitle without package notes", () => {
  const snapshot = buildReservationServiceSnapshot({
    serviceType: "transfer",
    tourCode: null,
    durationHours: null,
    bursaRoute: null,
    vehicleCode: STANDARD_MINIVAN_CODE,
  });
  assert.equal(
    snapshot.locales.tr.vehicleSubtitle,
    "Volkswagen Caravelle veya benzeri",
  );
  assert.equal(snapshot.locales.tr.packageCoverage, null);
  assert.deepEqual(snapshot.locales.tr.packageNotes, []);
});

test("vehicle tour snapshots cover every bookable package tour", () => {
  const expected = new Map([
    ["istanbul-layover", "7 saat / 120 km"],
    ["istanbul-half-day", "6 saat / 70 km"],
    ["istanbul-full-day", "10 saat / 110 km"],
    ["sapanca", "11 saat"],
  ]);
  for (const [tourCode, coverage] of expected) {
    const snapshot = buildReservationServiceSnapshot({
      serviceType: "tour",
      tourCode,
      durationHours: null,
      bursaRoute: null,
      vehicleCode: STANDARD_MINIVAN_CODE,
    });
    assert.equal(snapshot.locales.tr.packageCoverage, coverage);
    assert.ok(snapshot.locales.tr.packageNotes.length > 0);
  }
});

test("Bursa snapshot records only the applied route and Uludag state", () => {
  const base = {
    serviceType: "tour",
    tourCode: "bursa",
    durationHours: 12,
    vehicleCode: STANDARD_MINIVAN_CODE,
  };
  assert.equal(
    buildReservationServiceSnapshot({
      ...base,
      bursaRoute: BURSA_ROUTE_FERRY,
    }).locales.tr.packageCoverage,
    "12 saat · Normal yol + feribot",
  );
  const selected = buildReservationServiceSnapshot({
    ...base,
    bursaRoute: BURSA_ROUTE_BRIDGE_ULUDAG,
  }).locales.tr;
  assert.equal(
    selected.packageCoverage,
    "12 saat · Köprü + otoyol · Uludağ araçla çıkış",
  );
  assert.deepEqual(selected.packageNotes, ["Süre aşımı: +16,50 EUR / saat"]);
});

test("Bosphorus snapshot includes duration and three localized service groups", () => {
  const snapshot = buildReservationServiceSnapshot({
    serviceType: "tour",
    tourCode: "bosphorus-dinner",
    durationHours: null,
    bursaRoute: null,
    vehicleCode: null,
  });
  for (const locale of ["tr", "en", "ru"] as const) {
    assert.equal(snapshot.locales[locale].includedItems.length, 7);
    assert.equal(snapshot.locales[locale].serviceInfoGroups.length, 3);
  }
  assert.match(snapshot.locales.tr.includedItems.at(-1) ?? "", /2,5 saat/);
  assert.match(snapshot.locales.tr.serviceInfoGroups[0].body, /20:30/);
  assert.match(snapshot.locales.tr.serviceInfoGroups[0].body, /19:30–20:00/);
  assert.match(snapshot.locales.tr.serviceInfoGroups[2].body, /iki ayrı transfer/);
});

