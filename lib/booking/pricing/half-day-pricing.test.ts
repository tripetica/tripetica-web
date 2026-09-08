import test from "node:test";
import assert from "node:assert/strict";
import { PREMIUM_ECONOMY_SEDAN, quoteVehicle } from "@/lib/booking/pricing/vehicle-quote";
import {
  HALF_DAY_BASE_EUR,
  HALF_DAY_PRICING_VERSION,
  HALF_DAY_TOUR_CODE,
  isHalfDayTour,
  quoteHalfDayBase,
} from "@/lib/booking/pricing/half-day-pricing";

const istanbulGeo = {
  provinceCode: "istanbul" as const,
  districtCode: "besiktas",
};

test("half-day base quote is flat 115 EUR", () => {
  const quote = quoteHalfDayBase(istanbulGeo);
  assert.equal(quote.pricingVersion, HALF_DAY_PRICING_VERSION);
  assert.equal(quote.baseTransferFeeEur, HALF_DAY_BASE_EUR);
  assert.equal(quote.distanceFeeEur, 0);
});

test("half-day tour detection", () => {
  assert.equal(isHalfDayTour("tour", HALF_DAY_TOUR_CODE), true);
  assert.equal(isHalfDayTour("tour", "istanbul-layover"), false);
});

test("half-day vehicle quote reuses existing multipliers", () => {
  const base = quoteHalfDayBase(istanbulGeo);
  const vehicle = quoteVehicle(PREMIUM_ECONOMY_SEDAN.code, base, {
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(vehicle.baseServiceFeeEur, HALF_DAY_BASE_EUR);
});
