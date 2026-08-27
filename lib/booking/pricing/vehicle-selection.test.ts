import test from "node:test";
import assert from "node:assert/strict";
import { vehicleQuoteViewFromApplied, isKnownVehicleCode, isVehicleCodeVisible } from "@/lib/booking/fx/vehicle-totals";
import { PREMIUM_ECONOMY_SEDAN_CODE, STANDARD_MINIVAN_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { fxBookFromEurRates } from "@/lib/booking/fx/convert";
import { buildFxSnapshot } from "@/lib/booking/fx/convert";

const quote = {
  openingFeeEur: 23,
  distanceFeeEur: 16.5,
  locationSurchargeEur: 0,
  timeSurchargeEur: 0,
  baseTransferFeeEur: 39.5,
  pricingVersion: "transfer-pricing.v1",
  pickupProvinceCode: "istanbul" as const,
  pickupDistrictCode: "besiktas",
  dropoffProvinceCode: "istanbul" as const,
  dropoffDistrictCode: "kadikoy",
};

test("known vehicle codes are the visible catalog", () => {
  assert.equal(isKnownVehicleCode(PREMIUM_ECONOMY_SEDAN_CODE), true);
  assert.equal(isKnownVehicleCode(STANDARD_MINIVAN_CODE), true);
  assert.equal(isKnownVehicleCode("hoverboard"), false);
});

test("unset occupancy keeps every known vehicle visible", () => {
  const occupancy = {
    passengerCount: null,
    luggageCount: null,
    babySeatCount: null,
    meetAndGreet: false,
  };
  assert.equal(isVehicleCodeVisible(STANDARD_MINIVAN_CODE, occupancy), true);
});

test("frozen vehicle total uses quote FX rates for the selected currency", () => {
  const occupancy = {
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: false,
  };
  const book = fxBookFromEurRates({ USD: "1.1", EUR: "1", TRY: "50", RUB: "100", GBP: "0.85" });
  const snapshot = buildFxSnapshot(39.5, book);
  const sedan = vehicleQuoteViewFromApplied(quote, occupancy, { snapshot }, PREMIUM_ECONOMY_SEDAN_CODE);
  const minivan = vehicleQuoteViewFromApplied(quote, occupancy, { snapshot }, STANDARD_MINIVAN_CODE);
  assert.notEqual(sedan.totalEur, minivan.totalEur);
  const usd = minivan.totals.find((item) => item.code === "USD")?.amount;
  assert.equal(typeof usd, "number");
  assert.ok((usd ?? 0) > 0);
});
