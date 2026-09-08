import test from "node:test";
import assert from "node:assert/strict";
import {
  HOURLY_PRICING_VERSION,
  hourlyBaseEur,
  hourlyPickupSurchargeEur,
  quoteHourlyBase,
} from "@/lib/booking/pricing/hourly-pricing";
import { PREMIUM_ECONOMY_SEDAN, quoteVehicle } from "@/lib/booking/pricing/vehicle-quote";

test("hourly base is 100 EUR at 5 hours then +15 per hour", () => {
  assert.equal(hourlyBaseEur(5), 100);
  assert.equal(hourlyBaseEur(6), 115);
  assert.equal(hourlyBaseEur(7), 130);
  assert.equal(hourlyBaseEur(8), 145);
  assert.equal(hourlyBaseEur(9), 160);
  assert.equal(hourlyBaseEur(10), 175);
  assert.equal(hourlyBaseEur(20), 325);
});

test("IST and SAW airport pickups have no hourly pickup surcharge", () => {
  assert.equal(
    hourlyPickupSurchargeEur(
      { provinceCode: "istanbul", districtCode: "arnavutkoy" },
      "IST",
    ),
    0,
  );
  assert.equal(
    hourlyPickupSurchargeEur({ provinceCode: "istanbul", districtCode: "pendik" }, "SAW"),
    0,
  );
});

test("Istanbul district surcharge uses transfer district table", () => {
  assert.equal(
    hourlyPickupSurchargeEur({ provinceCode: "istanbul", districtCode: "bakirkoy" }, null),
    8,
  );
});

test("outside Istanbul surcharge is flat +50 (no Yalova/Bursa stack)", () => {
  assert.equal(
    hourlyPickupSurchargeEur({ provinceCode: "yalova", districtCode: null }, null),
    50,
  );
  assert.equal(
    hourlyPickupSurchargeEur({ provinceCode: "bursa", districtCode: null }, null),
    50,
  );
  assert.equal(
    hourlyPickupSurchargeEur({ provinceCode: "other", districtCode: null }, null),
    50,
  );
  assert.equal(
    hourlyPickupSurchargeEur({ provinceCode: "antalya", districtCode: null }, null),
    50,
  );
});

test("hourly quote does not bill pickup→dropoff route distance at reservation time", () => {
  assert.equal(
    quoteHourlyBase({
      durationHours: 5,
      pickup: { provinceCode: "istanbul", districtCode: "bakirkoy" },
      pickupAirportCode: null,
      dropoffDistanceKm: 0,
    }).distanceFeeEur,
    0,
  );
  assert.equal(
    quoteHourlyBase({
      durationHours: 5,
      pickup: { provinceCode: "istanbul", districtCode: "bakirkoy" },
      pickupAirportCode: null,
      dropoffDistanceKm: 8,
    }).baseTransferFeeEur,
    108,
  );
  const fifteen = quoteHourlyBase({
    durationHours: 5,
    pickup: { provinceCode: "istanbul", districtCode: "bakirkoy" },
    pickupAirportCode: null,
    dropoffDistanceKm: 15,
  });
  assert.equal(fifteen.distanceFeeEur, 0);
  assert.equal(fifteen.baseTransferFeeEur, 108);
  assert.equal(fifteen.hourlyDropoffDistanceKm, 15);

  const thirty = quoteHourlyBase({
    durationHours: 5,
    pickup: { provinceCode: "istanbul", districtCode: "bakirkoy" },
    pickupAirportCode: null,
    dropoffDistanceKm: 30,
  });
  assert.equal(thirty.distanceFeeEur, 0);
  assert.equal(thirty.baseTransferFeeEur, 108);
});

test("quote scenarios match product rules and feed vehicle multiplier", () => {
  const ist5 = quoteHourlyBase({
    durationHours: 5,
    pickup: { provinceCode: "istanbul", districtCode: "arnavutkoy" },
    pickupAirportCode: "IST",
  });
  assert.equal(ist5.baseTransferFeeEur, 100);
  assert.equal(ist5.pricingVersion, HOURLY_PRICING_VERSION);
  assert.equal(
    quoteVehicle(PREMIUM_ECONOMY_SEDAN.code, ist5, {
      passengerCount: 2,
      luggageCount: 2,
      babySeatCount: 0,
      meetAndGreet: false,
    }).totalEur,
    100,
  );

  const saw5 = quoteHourlyBase({
    durationHours: 5,
    pickup: { provinceCode: "istanbul", districtCode: "pendik" },
    pickupAirportCode: "SAW",
  });
  assert.equal(saw5.baseTransferFeeEur, 100);

  const bakirkoy8 = quoteHourlyBase({
    durationHours: 8,
    pickup: { provinceCode: "istanbul", districtCode: "bakirkoy" },
    pickupAirportCode: null,
  });
  assert.equal(bakirkoy8.baseTransferFeeEur, 153);

  const outside10 = quoteHourlyBase({
    durationHours: 10,
    pickup: { provinceCode: "other", districtCode: null },
    pickupAirportCode: null,
  });
  assert.equal(outside10.baseTransferFeeEur, 225);
});
