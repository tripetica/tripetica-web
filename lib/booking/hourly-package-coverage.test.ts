import assert from "node:assert/strict";
import test from "node:test";
import {
  formatHourlyPackageCoverage,
  formatHourlyPackageOverrunNote,
  formatHourlyVehicleTariffRows,
  hourlyVehicleTariffCopy,
} from "@/lib/booking/catalog";

test("hourly package coverage uses durationOptions hours→km mapping", () => {
  assert.equal(formatHourlyPackageCoverage(5, "tr"), "5 saat / 60 km");
  assert.equal(formatHourlyPackageCoverage(7, "tr"), "7 saat / 80 km");
  assert.equal(formatHourlyPackageCoverage(7, "en"), "7 hours / 80 km");
  assert.equal(formatHourlyPackageCoverage(7, "ru"), "7 часов / 80 км");
  assert.equal(formatHourlyPackageCoverage(20, "tr"), "20 saat / 220 km");
  assert.equal(formatHourlyPackageCoverage(3, "tr"), null);
});

test("hourly overrun note lists rules without adding reservation-time fees", () => {
  const note = formatHourlyPackageOverrunNote("tr");
  assert.match(note, /Süre aşımı: \+15 EUR \/ saat/);
  assert.match(note, /Kilometre aşımı: \+0,50 EUR \/ km/);
  assert.match(note, /Avrupa–Anadolu geçişi: \+15 EUR/);
  assert.match(note, /fiilî kullanıma göre ayrıca ücretlendirilir/);
  assert.equal(
    hourlyVehicleTariffCopy.tr.packageLabel,
    "Paket kapsamı",
  );
});

test("hourly vehicle tariff rows use localized dynamic values", () => {
  assert.deepEqual(formatHourlyVehicleTariffRows(5, "tr"), {
    packageCoverage: "Paket kapsamı: 5 saat / 60 km",
    hourOverrun: "Süre aşımı: +15,00 EUR / saat",
    kmOverrun: "Kilometre aşımı: +0,50 EUR / km",
    crossingFee: "Avrupa–Anadolu geçişi: +15 EUR",
  });
  assert.deepEqual(formatHourlyVehicleTariffRows(5, "tr", 1.1), {
    packageCoverage: "Paket kapsamı: 5 saat / 60 km",
    hourOverrun: "Süre aşımı: +16,50 EUR / saat",
    kmOverrun: "Kilometre aşımı: +0,55 EUR / km",
    crossingFee: "Avrupa–Anadolu geçişi: +15 EUR",
  });
  assert.equal(
    formatHourlyVehicleTariffRows(7, "en")?.packageCoverage,
    "Package coverage: 7 hours / 80 km",
  );
  assert.equal(
    formatHourlyVehicleTariffRows(7, "ru")?.packageCoverage,
    "Пакет включает: 7 часов / 80 км",
  );
});
