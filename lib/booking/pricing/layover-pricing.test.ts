import test from "node:test";
import assert from "node:assert/strict";
import { PREMIUM_ECONOMY_SEDAN, quoteVehicle } from "@/lib/booking/pricing/vehicle-quote";
import {
  LAYOVER_PRICING_VERSION,
  quoteLayoverBase,
} from "@/lib/booking/pricing/layover-pricing";

const istanbulGeo = {
  provinceCode: "istanbul" as const,
  districtCode: "arnavutkoy",
};

test("layover base quote uses IST→IST matrix price", () => {
  const quote = quoteLayoverBase(istanbulGeo, {
    pickupAirportCode: "IST",
    dropoffAirportCode: "IST",
  });
  assert.equal(quote.pricingVersion, LAYOVER_PRICING_VERSION);
  assert.equal(quote.baseTransferFeeEur, 140);
  assert.equal(quote.distanceFeeEur, 0);
  assert.equal(quote.locationSurchargeEur, 0);
});

test("layover base quote uses IST→SAW matrix price", () => {
  const quote = quoteLayoverBase(istanbulGeo, {
    pickupAirportCode: "IST",
    dropoffAirportCode: "SAW",
  });
  assert.equal(quote.baseTransferFeeEur, 150);
});

test("layover base quote uses SAW→IST matrix price", () => {
  const quote = quoteLayoverBase(istanbulGeo, {
    pickupAirportCode: "SAW",
    dropoffAirportCode: "IST",
  });
  assert.equal(quote.baseTransferFeeEur, 150);
});

test("layover base quote uses SAW→SAW matrix price", () => {
  const quote = quoteLayoverBase(istanbulGeo, {
    pickupAirportCode: "SAW",
    dropoffAirportCode: "SAW",
  });
  assert.equal(quote.baseTransferFeeEur, 160);
});

test("layover vehicle quote scales from matrix base", () => {
  const base = quoteLayoverBase(istanbulGeo, {
    pickupAirportCode: "IST",
    dropoffAirportCode: "IST",
  });
  const vehicle = quoteVehicle(PREMIUM_ECONOMY_SEDAN.code, base, {
    passengerCount: 1,
    luggageCount: 0,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(vehicle.baseServiceFeeEur, 140);
  assert.equal(vehicle.totalEur, 140);
});

test("layover extra passenger fee applies on top of matrix base", () => {
  const base = quoteLayoverBase(istanbulGeo, {
    pickupAirportCode: "SAW",
    dropoffAirportCode: "SAW",
  });
  const vehicle = quoteVehicle(PREMIUM_ECONOMY_SEDAN.code, base, {
    passengerCount: 3,
    luggageCount: 0,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.ok(vehicle.extraPassengerFeeEur > 0);
  assert.equal(vehicle.totalEur, 160 + vehicle.extraPassengerFeeEur);
});
