import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_MINIVAN,
  PREMIUM_ECONOMY_SEDAN,
  STANDARD_MINIVAN,
  quoteVehicle,
} from "@/lib/booking/pricing/vehicle-quote";
import { vehicleAdjustedOverageRateEur } from "@/lib/booking/pricing/euro";
import {
  formatBursaPackageCoverage,
  layoverVehicleTariffCopyForVehicle,
  packageTourVehicleTariffCopy,
} from "@/lib/booking/tour-display";
import {
  BURSA_ROUTE_BRIDGE_ULUDAG,
  BURSA_ROUTE_FERRY,
  BURSA_ROUTE_FERRY_ULUDAG,
  quoteBursaBase,
} from "@/lib/booking/pricing/bursa-pricing";

const base = {
  openingFeeEur: 100,
  distanceFeeEur: 0,
  locationSurchargeEur: 0,
  timeSurchargeEur: 0,
  baseTransferFeeEur: 100,
  pricingVersion: "test",
  pickupProvinceCode: "istanbul" as const,
  pickupDistrictCode: null,
  dropoffProvinceCode: "other" as const,
  dropoffDistrictCode: null,
};

const occupancy = {
  passengerCount: 2,
  luggageCount: 2,
  babySeatCount: 0,
  meetAndGreet: false,
};

test("vehicle overage rates use fixed-point multiplier math", () => {
  assert.equal(vehicleAdjustedOverageRateEur("15", "1.00"), 15);
  assert.equal(vehicleAdjustedOverageRateEur("0.50", "1.10"), 0.55);
  assert.equal(vehicleAdjustedOverageRateEur("15", "1.20"), 18);
  assert.equal(vehicleAdjustedOverageRateEur("0.50", "1.50"), 0.75);
});

test("quote views expose the multiplier from the shared vehicle config", () => {
  assert.equal(
    quoteVehicle(PREMIUM_ECONOMY_SEDAN.code, base, occupancy).multiplier,
    Number(PREMIUM_ECONOMY_SEDAN.multiplier),
  );
  assert.equal(
    quoteVehicle(STANDARD_MINIVAN.code, base, occupancy).multiplier,
    Number(STANDARD_MINIVAN.multiplier),
  );
  assert.equal(
    quoteVehicle(BUSINESS_MINIVAN.code, base, occupancy).multiplier,
    Number(BUSINESS_MINIVAN.multiplier),
  );
});

test("tour card rates are adjusted while fixed crossing fees stay unchanged", () => {
  const halfDay = packageTourVehicleTariffCopy(
    "istanbul-half-day",
    "tr",
    1.1,
  );
  assert.equal(halfDay?.hourOverrun, "Süre aşımı: +16,50 EUR / saat");
  assert.equal(halfDay?.kmOverrun, "Kilometre aşımı: +0,55 EUR / km");
  assert.equal(halfDay?.crossingFee, "Avrupa–Anadolu geçişi: +15 EUR");

  const layover = layoverVehicleTariffCopyForVehicle("en", 1.2);
  assert.equal(layover.hourOverrun, "Time overrun: +18.00 EUR / hour");
  assert.equal(layover.kmOverrun, "Distance overrun: +0.60 EUR / km");

  const bursa = packageTourVehicleTariffCopy("bursa", "tr", 1);
  assert.equal(bursa?.bridgeRouteSurcharge, "Köprü + otoyol tercihi: +50 EUR");
});

test("Bursa paid options remain flat and package coverage reflects applied combination", () => {
  const bursaBase = quoteBursaBase(
    {
      provinceCode: "istanbul",
      districtCode: null,
    },
    BURSA_ROUTE_BRIDGE_ULUDAG,
  );
  const quote = quoteVehicle(STANDARD_MINIVAN.code, bursaBase, occupancy);
  assert.equal(quote.totalEur - quote.baseServiceFeeEur, 100);

  assert.equal(
    formatBursaPackageCoverage("tr", BURSA_ROUTE_FERRY),
    "12 saat · Normal yol + feribot",
  );
  assert.equal(
    formatBursaPackageCoverage("tr", BURSA_ROUTE_FERRY_ULUDAG),
    "12 saat · Normal yol + feribot · Uludağ araçla çıkış",
  );
  assert.equal(
    formatBursaPackageCoverage("en", BURSA_ROUTE_BRIDGE_ULUDAG),
    "12 hours · Bridge + motorway · Uludağ ascent by vehicle",
  );
});
