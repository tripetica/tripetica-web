import test from "node:test";
import assert from "node:assert/strict";
import { PREMIUM_ECONOMY_SEDAN, quoteVehicle } from "@/lib/booking/pricing/vehicle-quote";
import {
  FULL_DAY_BASE_EUR,
  FULL_DAY_PRICING_VERSION,
  FULL_DAY_TOUR_CODE,
  isFullDayTour,
  quoteFullDayBase,
} from "@/lib/booking/pricing/full-day-pricing";

const istanbulGeo = {
  provinceCode: "istanbul" as const,
  districtCode: "besiktas",
};

test("full-day base quote is flat 175 EUR", () => {
  const quote = quoteFullDayBase(istanbulGeo);
  assert.equal(quote.pricingVersion, FULL_DAY_PRICING_VERSION);
  assert.equal(quote.baseTransferFeeEur, FULL_DAY_BASE_EUR);
  assert.equal(quote.distanceFeeEur, 0);
});

test("full-day tour detection", () => {
  assert.equal(isFullDayTour("tour", FULL_DAY_TOUR_CODE), true);
  assert.equal(isFullDayTour("tour", "istanbul-half-day"), false);
});

test("full-day vehicle quote reuses existing multipliers", () => {
  const base = quoteFullDayBase(istanbulGeo);
  const vehicle = quoteVehicle(PREMIUM_ECONOMY_SEDAN.code, base, {
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(vehicle.baseServiceFeeEur, FULL_DAY_BASE_EUR);
});
