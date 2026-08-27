import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTransferLocation } from "./location-codes";
import {
  calculatePickupTimeSurcharge,
  quoteTransferBase,
} from "./transfer-pricing";
import {
  isBusinessMinivanVisible,
  isBusVisible,
  isFirstClassMinivanVisible,
  isFirstClassSedanVisible,
  isMinibusVisible,
  isMidibusVisible,
  isPremiumEconomySedanVisible,
  isStandardMinivanVisible,
  BUS_CODE,
  BUSINESS_MINIVAN_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MIDIBUS_CODE,
  MINIBUS_CODE,
  occupancyForVehicleQuotes,
  PREMIUM_ECONOMY_SEDAN_CODE,
  meetAndGreetForVehicleSelection,
  quoteBusinessMinivan,
  quoteBus,
  quoteFirstClassMinivan,
  quoteFirstClassSedan,
  quoteMinibus,
  quoteMidibus,
  quotePremiumEconomySedan,
  quoteStandardMinivan,
  quoteVehicle,
  STANDARD_MINIVAN_CODE,
} from "./vehicle-quote";

function pickupTimeQuote(
  district: string,
  pickupAtLocal: string,
  dropoffDistrict = "besiktas",
) {
  return quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal,
    pickup: { provinceCode: "istanbul", districtCode: district },
    dropoff: { provinceCode: "istanbul", districtCode: dropoffDistrict },
  }).timeSurchargeEur;
}

const noLocation = {
  pickup: { provinceCode: "istanbul" as const, districtCode: "besiktas" },
  dropoff: { provinceCode: "istanbul" as const, districtCode: "besiktas" },
  pickupAtLocal: "2026-08-28T10:00",
};

test("15 km opening fee and first band", () => {
  const quote = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  assert.equal(quote.openingFeeEur, 25);
  assert.equal(quote.distanceFeeEur, 8.25);
  assert.equal(quote.locationSurchargeEur, 0);
  assert.equal(quote.timeSurchargeEur, 0);
  assert.equal(quote.baseTransferFeeEur, 33.25);
});

test("30 km uses the 23 opening fee, not 15", () => {
  const quote = quoteTransferBase({ ...noLocation, distanceKm: 30 });
  assert.equal(quote.openingFeeEur, 23);
  assert.equal(quote.distanceFeeEur, 16.5);
  assert.equal(quote.baseTransferFeeEur, 39.5);
});

test("60 km uses the 15 opening fee and first band only", () => {
  const quote = quoteTransferBase({ ...noLocation, distanceKm: 60 });
  assert.equal(quote.openingFeeEur, 15);
  assert.equal(quote.distanceFeeEur, 33);
  assert.equal(quote.baseTransferFeeEur, 48);
});

test("61 km starts the second distance band", () => {
  const quote = quoteTransferBase({ ...noLocation, distanceKm: 61 });
  assert.equal(quote.openingFeeEur, 15);
  assert.equal(quote.distanceFeeEur, 33.6);
  assert.equal(quote.baseTransferFeeEur, 48.6);
});

test("90 km progressive bands", () => {
  const quote = quoteTransferBase({ ...noLocation, distanceKm: 90 });
  assert.equal(quote.distanceFeeEur, 51);
  assert.equal(quote.baseTransferFeeEur, 66);
});

test("120 km progressive bands", () => {
  const quote = quoteTransferBase({ ...noLocation, distanceKm: 120 });
  assert.equal(quote.distanceFeeEur, 70.5);
  assert.equal(quote.baseTransferFeeEur, 85.5);
});

test("Bakirkoy and Sultanbeyli apply only the higher district fee", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T10:00",
    pickup: { provinceCode: "istanbul", districtCode: "bakirkoy" },
    dropoff: { provinceCode: "istanbul", districtCode: "sultanbeyli" },
  });
  assert.equal(quote.locationSurchargeEur, 15);
  assert.equal(quote.baseTransferFeeEur, 48.25);
});

test("Tuzla and Sile apply only the higher district fee", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T10:00",
    pickup: { provinceCode: "istanbul", districtCode: "tuzla" },
    dropoff: { provinceCode: "istanbul", districtCode: "sile" },
  });
  assert.equal(quote.locationSurchargeEur, 40);
});

test("out-of-Istanbul location fee is 50", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T10:00",
    pickup: { provinceCode: "other", districtCode: null },
    dropoff: { provinceCode: "istanbul", districtCode: "besiktas" },
  });
  assert.equal(quote.locationSurchargeEur, 50);
});

test("Bursa location fee is 90", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T10:00",
    pickup: { provinceCode: "istanbul", districtCode: "besiktas" },
    dropoff: { provinceCode: "bursa", districtCode: null },
  });
  assert.equal(quote.locationSurchargeEur, 90);
});

test("Yalova location fee is 90", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T10:00",
    pickup: { provinceCode: "yalova", districtCode: null },
    dropoff: { provinceCode: "istanbul", districtCode: "besiktas" },
  });
  assert.equal(quote.locationSurchargeEur, 90);
});

test("Antalya location fee is 0", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T10:00",
    pickup: { provinceCode: "antalya", districtCode: null },
    dropoff: { provinceCode: "antalya", districtCode: null },
  });
  assert.equal(quote.locationSurchargeEur, 0);
  assert.equal(quote.baseTransferFeeEur, 33.25);
});

test("Kartal at 14:00 adds 15 pickup-time surcharge", () => {
  assert.equal(
    calculatePickupTimeSurcharge({
      appliedPickupDistrictCode: "kartal",
      appliedPickupDateTime: "2026-08-28T14:00",
    }),
    15,
  );
  assert.equal(pickupTimeQuote("kartal", "2026-08-28T14:00"), 15);
});

test("Maltepe at 20:30 adds 15 pickup-time surcharge", () => {
  assert.equal(
    calculatePickupTimeSurcharge({
      appliedPickupDistrictCode: "maltepe",
      appliedPickupDateTime: "2026-08-28T20:30",
    }),
    15,
  );
  assert.equal(pickupTimeQuote("maltepe", "2026-08-28T20:30"), 15);
});

test("Tuzla at 13:00 inclusive adds 15 pickup-time surcharge", () => {
  assert.equal(
    calculatePickupTimeSurcharge({
      appliedPickupDistrictCode: "tuzla",
      appliedPickupDateTime: "2026-08-28T13:00",
    }),
    15,
  );
  assert.equal(pickupTimeQuote("tuzla", "2026-08-28T13:00"), 15);
});

test("Atasehir at 14:00 adds 5 pickup-time surcharge", () => {
  assert.equal(
    calculatePickupTimeSurcharge({
      appliedPickupDistrictCode: "atasehir",
      appliedPickupDateTime: "2026-08-28T14:00",
    }),
    5,
  );
  assert.equal(pickupTimeQuote("atasehir", "2026-08-28T14:00"), 5);
});

test("Uskudar at 21:00 inclusive adds 5 pickup-time surcharge", () => {
  assert.equal(
    calculatePickupTimeSurcharge({
      appliedPickupDistrictCode: "uskudar",
      appliedPickupDateTime: "2026-08-28T21:00",
    }),
    5,
  );
  assert.equal(pickupTimeQuote("uskudar", "2026-08-28T21:00"), 5);
});

test("Pendik at 12:55 is outside the window", () => {
  assert.equal(
    calculatePickupTimeSurcharge({
      appliedPickupDistrictCode: "pendik",
      appliedPickupDateTime: "2026-08-28T12:55",
    }),
    0,
  );
  assert.equal(pickupTimeQuote("pendik", "2026-08-28T12:55"), 0);
});

test("Pendik at 21:05 is outside the window", () => {
  assert.equal(
    calculatePickupTimeSurcharge({
      appliedPickupDistrictCode: "pendik",
      appliedPickupDateTime: "2026-08-28T21:05",
    }),
    0,
  );
  assert.equal(pickupTimeQuote("pendik", "2026-08-28T21:05"), 0);
});

test("pickup Besiktas drop-off Tuzla at 15:00 has 0 time surcharge", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T15:00",
    pickup: { provinceCode: "istanbul", districtCode: "besiktas" },
    dropoff: { provinceCode: "istanbul", districtCode: "tuzla" },
  });
  assert.equal(quote.timeSurchargeEur, 0);
});

test("pickup Kadikoy drop-off Pendik at 15:00 adds only 5", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T15:00",
    pickup: { provinceCode: "istanbul", districtCode: "kadikoy" },
    dropoff: { provinceCode: "istanbul", districtCode: "pendik" },
  });
  assert.equal(quote.timeSurchargeEur, 5);
});

test("pickup Pendik drop-off Uskudar at 15:00 adds only 15", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T15:00",
    pickup: { provinceCode: "istanbul", districtCode: "pendik" },
    dropoff: { provinceCode: "istanbul", districtCode: "uskudar" },
  });
  assert.equal(quote.timeSurchargeEur, 15);
});

test("localized Fatih labels do not change pickup-time surcharge", () => {
  assert.equal(
    calculatePickupTimeSurcharge({
      appliedPickupDistrictCode: "fatih",
      appliedPickupDateTime: "2026-08-28T15:00",
    }),
    0,
  );
});

test("UTC instants are evaluated in Europe/Istanbul", () => {
  // 12:00 UTC = 15:00 in Istanbul (UTC+3, no DST in 2026-08).
  assert.equal(
    calculatePickupTimeSurcharge({
      appliedPickupDistrictCode: "pendik",
      appliedPickupDateTime: "2026-08-28T12:00:00.000Z",
    }),
    15,
  );
});

test("drop-off Pendik does not trigger the time surcharge", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T15:00",
    pickup: { provinceCode: "istanbul", districtCode: "besiktas" },
    dropoff: { provinceCode: "istanbul", districtCode: "pendik" },
  });
  assert.equal(quote.timeSurchargeEur, 0);
  assert.equal(quote.locationSurchargeEur, 10);
});

test("vehicle extras are zero for 2 passengers and 2 bags", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quotePremiumEconomySedan(base, {
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(vehicle.extraPassengerFeeEur, 0);
  assert.equal(vehicle.extraLuggageFeeEur, 0);
  assert.equal(vehicle.babySeatFeeEur, 0);
  assert.equal(vehicle.meetAndGreetFeeEur, 0);
  assert.equal(vehicle.totalEur, 33.25);
});

test("3 passengers add 1 euro", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quotePremiumEconomySedan(base, {
    passengerCount: 3,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(vehicle.extraPassengerFeeEur, 1);
});

test("3 bags add 1 euro", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quotePremiumEconomySedan(base, {
    passengerCount: 2,
    luggageCount: 3,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(vehicle.extraLuggageFeeEur, 1);
});

test("1 baby seat adds 10 euro", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quotePremiumEconomySedan(base, {
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 1,
    meetAndGreet: false,
  });
  assert.equal(vehicle.babySeatFeeEur, 10);
});

test("meet and greet adds 5 euro", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quotePremiumEconomySedan(base, {
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: true,
  });
  assert.equal(vehicle.meetAndGreetFeeEur, 5);
});

test("meet and greet state charges every vehicle except first class", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const airportPickup = { airportCode: "IST", type: "airport" };
  const counts = { passengerCount: 2, luggageCount: 2, babySeatCount: 0 };
  const on = occupancyForVehicleQuotes(counts, true, airportPickup);
  const off = occupancyForVehicleQuotes(counts, false, airportPickup);
  assert.equal(on.meetAndGreet, true);
  assert.equal(off.meetAndGreet, false);
  assert.equal(quoteVehicle(FIRST_CLASS_SEDAN_CODE, base, on).meetAndGreetFeeEur, 0);
  assert.equal(quoteVehicle(FIRST_CLASS_MINIVAN_CODE, base, on).meetAndGreetFeeEur, 0);
  assert.equal(
    quoteVehicle(FIRST_CLASS_SEDAN_CODE, base, on).totalEur,
    quoteVehicle(FIRST_CLASS_SEDAN_CODE, base, off).totalEur,
  );
  assert.equal(
    quoteVehicle(FIRST_CLASS_MINIVAN_CODE, base, on).totalEur,
    quoteVehicle(FIRST_CLASS_MINIVAN_CODE, base, off).totalEur,
  );
  for (const code of [
    PREMIUM_ECONOMY_SEDAN_CODE,
    STANDARD_MINIVAN_CODE,
    BUSINESS_MINIVAN_CODE,
    MINIBUS_CODE,
    MIDIBUS_CODE,
    BUS_CODE,
  ]) {
    const charged = quoteVehicle(code, base, on);
    const plain = quoteVehicle(code, base, off);
    assert.ok(charged.meetAndGreetFeeEur > 0, code);
    assert.equal(charged.meetAndGreetFeeEur, charged.totalEur - plain.totalEur);
  }
});

test("first class vehicle selection commits meet and greet as true", () => {
  const airport = { airportCode: "IST", type: "airport" };
  const hotel = { type: "place" };
  assert.equal(
    meetAndGreetForVehicleSelection(FIRST_CLASS_SEDAN_CODE, airport, false),
    true,
  );
  assert.equal(
    meetAndGreetForVehicleSelection(FIRST_CLASS_MINIVAN_CODE, airport, false),
    true,
  );
  assert.equal(
    meetAndGreetForVehicleSelection(PREMIUM_ECONOMY_SEDAN_CODE, airport, false),
    false,
  );
  assert.equal(
    meetAndGreetForVehicleSelection(STANDARD_MINIVAN_CODE, airport, true),
    true,
  );
  assert.equal(
    meetAndGreetForVehicleSelection(FIRST_CLASS_SEDAN_CODE, hotel, false),
    false,
  );
});

test("combined vehicle extras sum correctly", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quotePremiumEconomySedan(base, {
    passengerCount: 3,
    luggageCount: 3,
    babySeatCount: 1,
    meetAndGreet: true,
  });
  assert.equal(vehicle.totalEur, 50.25);
});

test("does not treat Istanbul Caddesi as Istanbul province", () => {
  const geo = classifyTransferLocation({
    city: null,
    district: null,
    region: "Ankara",
    country: "Türkiye",
  });
  assert.equal(geo.provinceCode, "other");
});

test("uses structured Istanbul district components", () => {
  const geo = classifyTransferLocation({
    city: "Pendik",
    district: "Pendik",
    region: "İstanbul",
    country: "Türkiye",
  });
  assert.equal(geo.provinceCode, "istanbul");
  assert.equal(geo.districtCode, "pendik");
});

test("airport presets map to canonical districts", () => {
  assert.deepEqual(classifyTransferLocation({ airportCode: "SAW" }), {
    provinceCode: "istanbul",
    districtCode: "pendik",
  });
  assert.deepEqual(classifyTransferLocation({ airportCode: "AYT" }), {
    provinceCode: "antalya",
    districtCode: null,
  });
});

test("standard minivan base is transfer fee times 1.10", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quoteStandardMinivan(base, {
    passengerCount: 5,
    luggageCount: 5,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(base.baseTransferFeeEur, 33.25);
  assert.equal(vehicle.baseServiceFeeEur, 36.58);
  assert.equal(vehicle.extraPassengerFeeEur, 0);
  assert.equal(vehicle.extraLuggageFeeEur, 0);
  assert.equal(vehicle.babySeatFeeEur, 0);
  assert.equal(vehicle.meetAndGreetFeeEur, 0);
  assert.equal(vehicle.totalEur, 36.58);
});

test("standard minivan extra fees for 6 passengers, 6 bags, 1 baby seat", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quoteStandardMinivan(base, {
    passengerCount: 6,
    luggageCount: 6,
    babySeatCount: 1,
    meetAndGreet: false,
  });
  assert.equal(vehicle.extraPassengerFeeEur, 1);
  assert.equal(vehicle.extraLuggageFeeEur, 1);
  assert.equal(vehicle.babySeatFeeEur, 10);
  assert.equal(vehicle.totalEur, 48.58);
});

test("standard minivan extra fees for 7 passengers, 8 bags, 2 baby seats", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quoteStandardMinivan(base, {
    passengerCount: 7,
    luggageCount: 8,
    babySeatCount: 2,
    meetAndGreet: false,
  });
  assert.equal(vehicle.extraPassengerFeeEur, 2);
  assert.equal(vehicle.extraLuggageFeeEur, 3);
  assert.equal(vehicle.babySeatFeeEur, 20);
  assert.equal(vehicle.totalEur, 61.58);
});

test("standard minivan uses the same meet and greet fee as the sedan", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const occupancy = {
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: true,
  };
  assert.equal(quotePremiumEconomySedan(base, occupancy).meetAndGreetFeeEur, 5);
  assert.equal(quoteStandardMinivan(base, occupancy).meetAndGreetFeeEur, 5);
});

test("vehicle visibility follows applied occupancy limits", () => {
  const both = {
    passengerCount: 3,
    luggageCount: 3,
    babySeatCount: 1,
    meetAndGreet: false,
  };
  assert.equal(isPremiumEconomySedanVisible(both), true);
  assert.equal(isStandardMinivanVisible(both), true);

  assert.equal(
    isPremiumEconomySedanVisible({
      passengerCount: 4,
      luggageCount: 1,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isStandardMinivanVisible({
      passengerCount: 4,
      luggageCount: 1,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );

  assert.equal(
    isPremiumEconomySedanVisible({
      passengerCount: 1,
      luggageCount: 4,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isStandardMinivanVisible({
      passengerCount: 1,
      luggageCount: 4,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );

  assert.equal(
    isPremiumEconomySedanVisible({
      passengerCount: 2,
      luggageCount: 2,
      babySeatCount: 2,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isStandardMinivanVisible({
      passengerCount: 2,
      luggageCount: 2,
      babySeatCount: 2,
      meetAndGreet: false,
    }),
    true,
  );

  assert.equal(
    isStandardMinivanVisible({
      passengerCount: 7,
      luggageCount: 8,
      babySeatCount: 2,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isStandardMinivanVisible({
      passengerCount: 8,
      luggageCount: 1,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isStandardMinivanVisible({
      passengerCount: 1,
      luggageCount: 9,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isStandardMinivanVisible({
      passengerCount: 1,
      luggageCount: 0,
      babySeatCount: 3,
      meetAndGreet: false,
    }),
    false,
  );

  const unset = {
    passengerCount: null,
    luggageCount: null,
    babySeatCount: null,
    meetAndGreet: false,
  };
  assert.equal(isPremiumEconomySedanVisible(unset), true);
  assert.equal(isStandardMinivanVisible(unset), true);
  assert.equal(
    isStandardMinivanVisible({
      passengerCount: 1,
      luggageCount: null,
      babySeatCount: null,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isStandardMinivanVisible({
      passengerCount: 0,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
});

test("business minivan base is transfer fee times 1.20", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quoteBusinessMinivan(base, {
    passengerCount: 4,
    luggageCount: 4,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(base.baseTransferFeeEur, 33.25);
  assert.equal(vehicle.baseServiceFeeEur, 39.9);
  assert.equal(vehicle.extraPassengerFeeEur, 0);
  assert.equal(vehicle.extraLuggageFeeEur, 0);
  assert.equal(vehicle.totalEur, 39.9);
});

test("business minivan extra passenger fees", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  assert.equal(
    quoteBusinessMinivan(base, {
      passengerCount: 5,
      luggageCount: 4,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    1,
  );
  assert.equal(
    quoteBusinessMinivan(base, {
      passengerCount: 6,
      luggageCount: 4,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    2,
  );
});

test("business minivan extra luggage fees", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  assert.equal(
    quoteBusinessMinivan(base, {
      passengerCount: 4,
      luggageCount: 5,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    1,
  );
  assert.equal(
    quoteBusinessMinivan(base, {
      passengerCount: 4,
      luggageCount: 6,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    2,
  );
});

test("business minivan baby seat fees", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  assert.equal(
    quoteBusinessMinivan(base, {
      passengerCount: 4,
      luggageCount: 4,
      babySeatCount: 1,
      meetAndGreet: false,
    }).babySeatFeeEur,
    10,
  );
  assert.equal(
    quoteBusinessMinivan(base, {
      passengerCount: 4,
      luggageCount: 4,
      babySeatCount: 2,
      meetAndGreet: false,
    }).babySeatFeeEur,
    20,
  );
});

test("business minivan uses the same meet and greet fee as the sedan", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const occupancy = {
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: true,
  };
  assert.equal(quotePremiumEconomySedan(base, occupancy).meetAndGreetFeeEur, 5);
  assert.equal(quoteBusinessMinivan(base, occupancy).meetAndGreetFeeEur, 5);
});

test("business minivan visibility follows applied occupancy limits", () => {
  assert.equal(
    isBusinessMinivanVisible({
      passengerCount: 6,
      luggageCount: 6,
      babySeatCount: 2,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isBusinessMinivanVisible({
      passengerCount: 7,
      luggageCount: 1,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isBusinessMinivanVisible({
      passengerCount: 1,
      luggageCount: 7,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isBusinessMinivanVisible({
      passengerCount: 1,
      luggageCount: 1,
      babySeatCount: 3,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isBusinessMinivanVisible({
      passengerCount: 0,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
});

test("first class minivan base is transfer fee times 2.70", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quoteFirstClassMinivan(base, {
    passengerCount: 3,
    luggageCount: 3,
    babySeatCount: 0,
    meetAndGreet: true,
  });
  assert.equal(base.baseTransferFeeEur, 33.25);
  assert.equal(vehicle.baseServiceFeeEur, 89.78);
  assert.equal(vehicle.extraPassengerFeeEur, 0);
  assert.equal(vehicle.extraLuggageFeeEur, 0);
  assert.equal(vehicle.babySeatFeeEur, 0);
  assert.equal(vehicle.meetAndGreetFeeEur, 0);
  assert.equal(vehicle.totalEur, 89.78);
});

test("first class minivan extra passenger and luggage fees are 5 euro each", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  assert.equal(
    quoteFirstClassMinivan(base, {
      passengerCount: 4,
      luggageCount: 3,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    5,
  );
  assert.equal(
    quoteFirstClassMinivan(base, {
      passengerCount: 5,
      luggageCount: 3,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    10,
  );
  assert.equal(
    quoteFirstClassMinivan(base, {
      passengerCount: 3,
      luggageCount: 4,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    5,
  );
  assert.equal(
    quoteFirstClassMinivan(base, {
      passengerCount: 3,
      luggageCount: 5,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    10,
  );
});

test("first class minivan baby seat fees and no meet and greet charge", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const oneSeat = quoteFirstClassMinivan(base, {
    passengerCount: 3,
    luggageCount: 3,
    babySeatCount: 1,
    meetAndGreet: true,
  });
  assert.equal(oneSeat.babySeatFeeEur, 10);
  assert.equal(oneSeat.meetAndGreetFeeEur, 0);
  assert.equal(oneSeat.totalEur, 99.78);
  const twoSeats = quoteFirstClassMinivan(base, {
    passengerCount: 5,
    luggageCount: 5,
    babySeatCount: 2,
    meetAndGreet: true,
  });
  assert.equal(twoSeats.extraPassengerFeeEur, 10);
  assert.equal(twoSeats.extraLuggageFeeEur, 10);
  assert.equal(twoSeats.babySeatFeeEur, 20);
  assert.equal(twoSeats.meetAndGreetFeeEur, 0);
  assert.equal(twoSeats.totalEur, 129.78);
});

test("first class minivan visibility follows applied occupancy limits", () => {
  assert.equal(
    isFirstClassMinivanVisible({
      passengerCount: 5,
      luggageCount: 5,
      babySeatCount: 2,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isFirstClassMinivanVisible({
      passengerCount: 6,
      luggageCount: 1,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isFirstClassMinivanVisible({
      passengerCount: 1,
      luggageCount: 6,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isFirstClassMinivanVisible({
      passengerCount: 1,
      luggageCount: 0,
      babySeatCount: 3,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isFirstClassMinivanVisible({
      passengerCount: null,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isFirstClassMinivanVisible({
      passengerCount: 0,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
});

test("first class sedan uses eight times the transfer base", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quoteFirstClassSedan(base, {
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: true,
  });
  assert.equal(base.baseTransferFeeEur, 33.25);
  assert.equal(vehicle.baseServiceFeeEur, 266);
  assert.equal(vehicle.extraPassengerFeeEur, 0);
  assert.equal(vehicle.extraLuggageFeeEur, 0);
  assert.equal(vehicle.babySeatFeeEur, 0);
  assert.equal(vehicle.meetAndGreetFeeEur, 0);
  assert.equal(vehicle.totalEur, 266);
});

test("first class sedan extra passenger and luggage fees are 10 euro each", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  assert.equal(
    quoteFirstClassSedan(base, {
      passengerCount: 3,
      luggageCount: 2,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    10,
  );
  assert.equal(
    quoteFirstClassSedan(base, {
      passengerCount: 2,
      luggageCount: 3,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    10,
  );
});

test("first class sedan baby seat fee and no meet and greet charge", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const max = quoteFirstClassSedan(base, {
    passengerCount: 3,
    luggageCount: 3,
    babySeatCount: 1,
    meetAndGreet: true,
  });
  assert.equal(max.extraPassengerFeeEur, 10);
  assert.equal(max.extraLuggageFeeEur, 10);
  assert.equal(max.babySeatFeeEur, 20);
  assert.equal(max.meetAndGreetFeeEur, 0);
  assert.equal(max.totalEur, 306);
});

test("first class sedan visibility follows applied occupancy limits", () => {
  assert.equal(
    isFirstClassSedanVisible({
      passengerCount: 0,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isFirstClassSedanVisible({
      passengerCount: 3,
      luggageCount: 3,
      babySeatCount: 1,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isFirstClassSedanVisible({
      passengerCount: 4,
      luggageCount: 1,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isFirstClassSedanVisible({
      passengerCount: 1,
      luggageCount: 4,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isFirstClassSedanVisible({
      passengerCount: 1,
      luggageCount: 0,
      babySeatCount: 2,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isFirstClassSedanVisible({
      passengerCount: null,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
});

test("minibus uses 1.6 times the transfer base", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quoteMinibus(base, {
    passengerCount: 9,
    luggageCount: 9,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(base.baseTransferFeeEur, 33.25);
  assert.equal(vehicle.baseServiceFeeEur, 53.2);
  assert.equal(vehicle.extraPassengerFeeEur, 0);
  assert.equal(vehicle.extraLuggageFeeEur, 0);
  assert.equal(vehicle.babySeatFeeEur, 0);
  assert.equal(vehicle.meetAndGreetFeeEur, 0);
  assert.equal(vehicle.totalEur, 53.2);
});

test("minibus extra passenger and luggage fees match standard minivan", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  assert.equal(
    quoteMinibus(base, {
      passengerCount: 10,
      luggageCount: 9,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    1,
  );
  assert.equal(
    quoteMinibus(base, {
      passengerCount: 18,
      luggageCount: 9,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    9,
  );
  assert.equal(
    quoteMinibus(base, {
      passengerCount: 9,
      luggageCount: 10,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    1,
  );
  assert.equal(
    quoteMinibus(base, {
      passengerCount: 9,
      luggageCount: 19,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    10,
  );
});

test("minibus baby seat and meet and greet fees", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const withSeat = quoteMinibus(base, {
    passengerCount: 9,
    luggageCount: 9,
    babySeatCount: 1,
    meetAndGreet: false,
  });
  assert.equal(withSeat.babySeatFeeEur, 10);
  assert.equal(withSeat.meetAndGreetFeeEur, 0);
  assert.equal(withSeat.totalEur, 63.2);
  const withMeet = quoteMinibus(base, {
    passengerCount: 9,
    luggageCount: 9,
    babySeatCount: 0,
    meetAndGreet: true,
  });
  assert.equal(withMeet.meetAndGreetFeeEur, 7);
  assert.equal(withMeet.totalEur, 60.2);
  const max = quoteMinibus(base, {
    passengerCount: 18,
    luggageCount: 19,
    babySeatCount: 3,
    meetAndGreet: true,
  });
  assert.equal(max.extraPassengerFeeEur, 9);
  assert.equal(max.extraLuggageFeeEur, 10);
  assert.equal(max.babySeatFeeEur, 30);
  assert.equal(max.meetAndGreetFeeEur, 7);
  assert.equal(max.totalEur, 109.2);
});

test("minibus visibility follows applied occupancy limits", () => {
  assert.equal(
    isMinibusVisible({
      passengerCount: 0,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 1,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 6,
      luggageCount: 6,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 6,
      luggageCount: 7,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 7,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 9,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 2,
      luggageCount: 10,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 18,
      luggageCount: 19,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 1,
      luggageCount: 20,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 19,
      luggageCount: 1,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 19,
      luggageCount: 7,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 7,
      luggageCount: 20,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 18,
      luggageCount: 20,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 7,
      luggageCount: 7,
      babySeatCount: 4,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: 19,
      luggageCount: 20,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMinibusVisible({
      passengerCount: null,
      luggageCount: null,
      babySeatCount: null,
      meetAndGreet: false,
    }),
    false,
  );
});

test("midibus uses 5.4 times the transfer base", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quoteMidibus(base, {
    passengerCount: 20,
    luggageCount: 20,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(base.baseTransferFeeEur, 33.25);
  assert.equal(vehicle.baseServiceFeeEur, 179.55);
  assert.equal(vehicle.extraPassengerFeeEur, 0);
  assert.equal(vehicle.extraLuggageFeeEur, 0);
  assert.equal(vehicle.babySeatFeeEur, 0);
  assert.equal(vehicle.meetAndGreetFeeEur, 0);
  assert.equal(vehicle.totalEur, 179.55);
});

test("midibus extra passenger and luggage fees match minibus per-unit extras", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  assert.equal(
    quoteMidibus(base, {
      passengerCount: 21,
      luggageCount: 20,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    1,
  );
  assert.equal(
    quoteMidibus(base, {
      passengerCount: 25,
      luggageCount: 20,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    5,
  );
  assert.equal(
    quoteMidibus(base, {
      passengerCount: 20,
      luggageCount: 21,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    1,
  );
  assert.equal(
    quoteMidibus(base, {
      passengerCount: 20,
      luggageCount: 27,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    7,
  );
});

test("midibus baby seat and meet and greet fees", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const withSeat = quoteMidibus(base, {
    passengerCount: 20,
    luggageCount: 20,
    babySeatCount: 1,
    meetAndGreet: false,
  });
  assert.equal(withSeat.babySeatFeeEur, 10);
  assert.equal(withSeat.meetAndGreetFeeEur, 0);
  assert.equal(withSeat.totalEur, 189.55);
  const withMeet = quoteMidibus(base, {
    passengerCount: 20,
    luggageCount: 20,
    babySeatCount: 0,
    meetAndGreet: true,
  });
  assert.equal(withMeet.meetAndGreetFeeEur, 10);
  assert.equal(withMeet.totalEur, 189.55);
  const max = quoteMidibus(base, {
    passengerCount: 25,
    luggageCount: 27,
    babySeatCount: 3,
    meetAndGreet: true,
  });
  assert.equal(max.extraPassengerFeeEur, 5);
  assert.equal(max.extraLuggageFeeEur, 7);
  assert.equal(max.babySeatFeeEur, 30);
  assert.equal(max.meetAndGreetFeeEur, 10);
  assert.equal(max.totalEur, 231.55);
});

test("midibus visibility follows applied occupancy limits", () => {
  assert.equal(
    isMidibusVisible({
      passengerCount: 16,
      luggageCount: 17,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMidibusVisible({
      passengerCount: 17,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isMidibusVisible({
      passengerCount: 2,
      luggageCount: 18,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isMidibusVisible({
      passengerCount: 25,
      luggageCount: 27,
      babySeatCount: 5,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isMidibusVisible({
      passengerCount: 26,
      luggageCount: 18,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMidibusVisible({
      passengerCount: 17,
      luggageCount: 28,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMidibusVisible({
      passengerCount: 1,
      luggageCount: 28,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMidibusVisible({
      passengerCount: 26,
      luggageCount: 1,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMidibusVisible({
      passengerCount: 26,
      luggageCount: 17,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMidibusVisible({
      passengerCount: 16,
      luggageCount: 28,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isMidibusVisible({
      passengerCount: null,
      luggageCount: null,
      babySeatCount: null,
      meetAndGreet: false,
    }),
    false,
  );
});

test("bus uses 10 times the transfer base", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  const vehicle = quoteBus(base, {
    passengerCount: 35,
    luggageCount: 35,
    babySeatCount: 0,
    meetAndGreet: false,
  });
  assert.equal(base.baseTransferFeeEur, 33.25);
  assert.equal(vehicle.baseServiceFeeEur, 332.5);
  assert.equal(vehicle.extraPassengerFeeEur, 0);
  assert.equal(vehicle.extraLuggageFeeEur, 0);
  assert.equal(vehicle.babySeatFeeEur, 0);
  assert.equal(vehicle.meetAndGreetFeeEur, 0);
  assert.equal(vehicle.totalEur, 332.5);
});

test("bus extra passenger and luggage fees are one euro per unit over 35", () => {
  const base = quoteTransferBase({ ...noLocation, distanceKm: 15 });
  assert.equal(
    quoteBus(base, {
      passengerCount: 36,
      luggageCount: 35,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    1,
  );
  assert.equal(
    quoteBus(base, {
      passengerCount: 45,
      luggageCount: 35,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    10,
  );
  assert.equal(
    quoteBus(base, {
      passengerCount: 35,
      luggageCount: 36,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    1,
  );
  assert.equal(
    quoteBus(base, {
      passengerCount: 35,
      luggageCount: 45,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraLuggageFeeEur,
    10,
  );
  assert.equal(
    quoteBus(base, {
      passengerCount: 35,
      luggageCount: 35,
      babySeatCount: 0,
      meetAndGreet: false,
    }).extraPassengerFeeEur,
    0,
  );
  const withSeat = quoteBus(base, {
    passengerCount: 35,
    luggageCount: 35,
    babySeatCount: 1,
    meetAndGreet: false,
  });
  assert.equal(withSeat.babySeatFeeEur, 10);
  const withMeet = quoteBus(base, {
    passengerCount: 35,
    luggageCount: 35,
    babySeatCount: 0,
    meetAndGreet: true,
  });
  assert.equal(withMeet.meetAndGreetFeeEur, 15);
  const max = quoteBus(base, {
    passengerCount: 45,
    luggageCount: 45,
    babySeatCount: 3,
    meetAndGreet: true,
  });
  assert.equal(max.baseServiceFeeEur, 332.5);
  assert.equal(max.extraPassengerFeeEur, 10);
  assert.equal(max.extraLuggageFeeEur, 10);
  assert.equal(max.babySeatFeeEur, 30);
  assert.equal(max.meetAndGreetFeeEur, 15);
  assert.equal(max.totalEur, 397.5);
});

test("bus visibility follows applied occupancy limits", () => {
  assert.equal(
    isBusVisible({
      passengerCount: 24,
      luggageCount: 24,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isBusVisible({
      passengerCount: 25,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isBusVisible({
      passengerCount: 2,
      luggageCount: 25,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isBusVisible({
      passengerCount: 45,
      luggageCount: 45,
      babySeatCount: 5,
      meetAndGreet: false,
    }),
    true,
  );
  assert.equal(
    isBusVisible({
      passengerCount: 46,
      luggageCount: 25,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isBusVisible({
      passengerCount: 25,
      luggageCount: 46,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isBusVisible({
      passengerCount: 1,
      luggageCount: 46,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isBusVisible({
      passengerCount: 46,
      luggageCount: 1,
      babySeatCount: 0,
      meetAndGreet: false,
    }),
    false,
  );
  assert.equal(
    isBusVisible({
      passengerCount: null,
      luggageCount: null,
      babySeatCount: null,
      meetAndGreet: false,
    }),
    false,
  );
});
