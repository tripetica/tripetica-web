import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPLETION_CHECKOUT_STAGE,
  draftTripIsDirty,
  isPrimaryPassengerReady,
  validateDraftForCashCompletion,
  type CompletionDraft,
  type CompletionPassenger,
} from "@/lib/booking/complete-reservation-validation";

function emptyLocation() {
  return {
    nameCustomer: "Pickup",
    addressCustomer: "Addr",
    nameTr: null,
    placeId: "p1",
    latitude: 41,
    longitude: 29,
    locationType: "place",
    airportCode: null,
  };
}

function baseDraft(overrides: Partial<CompletionDraft> = {}): CompletionDraft {
  const location = emptyLocation();
  const dropoff = { ...location, nameCustomer: "Dropoff", placeId: "d1" };
  const pickupAt = new Date("2026-08-28T10:00:00.000Z");
  return {
    currentStage: COMPLETION_CHECKOUT_STAGE,
    serviceType: "transfer",
    appliedVehicleCode: "sedan",
    currency: "USD",
    appliedVehicleTotal: 44,
    appliedFxSnapshot: {
      baseCurrency: "EUR",
      totalEur: "40",
      totals: { EUR: "40", USD: "44", TRY: "1800", RUB: "4000", GBP: "34" },
      rates: {},
      capturedAt: "2026-08-28T10:00:00.000Z",
    },
    customerEmail: "trip@example.com",
    customerPhone: "+905551112233",
    selected: {
      pickup: location,
      dropoff,
      pickupAt,
      distanceKm: 40,
      durationHours: null,
      passengerCount: 1,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
      flightCode: null,
    },
    applied: {
      pickup: location,
      dropoff,
      pickupAt,
      distanceKm: 40,
      durationHours: null,
      passengerCount: 1,
      luggageCount: 0,
      babySeatCount: 0,
      meetAndGreet: false,
      flightCode: null,
    },
    passengers: [
      {
        sequenceNo: 1,
        firstName: "Trip",
        lastName: "Test",
        countryCode: "TR",
        gender: "male",
        isPrimaryPassenger: true,
      },
    ],
    ...overrides,
  };
}

test("clean applied draft passes cash completion validation", () => {
  assert.equal(validateDraftForCashCompletion(baseDraft()), null);
});

test("hourly draft does not require dropoff and persists with duration", () => {
  const emptyDropoff = {
    nameCustomer: null,
    addressCustomer: null,
    nameTr: null,
    placeId: null,
    latitude: null,
    longitude: null,
    locationType: null,
    airportCode: null,
  };
  const trip = {
    pickup: emptyLocation(),
    dropoff: emptyDropoff,
    pickupAt: new Date("2026-08-28T10:00:00.000Z"),
    distanceKm: null,
    durationHours: 8,
    passengerCount: 1,
    luggageCount: 0,
    babySeatCount: 0,
    meetAndGreet: false,
    flightCode: null,
  };
  assert.equal(
    validateDraftForCashCompletion(
      baseDraft({
        serviceType: "hourly",
        selected: trip,
        applied: trip,
      }),
    ),
    null,
  );
  assert.equal(
    validateDraftForCashCompletion(
      baseDraft({
        serviceType: "hourly",
        selected: { ...trip, durationHours: null },
        applied: { ...trip, durationHours: null },
      }),
    ),
    "duration",
  );
});

test("all tour types complete without a transfer dropoff", () => {
  const emptyDropoff = {
    nameCustomer: null,
    addressCustomer: null,
    nameTr: null,
    placeId: null,
    latitude: null,
    longitude: null,
    locationType: null,
    airportCode: null,
  };
  for (const tourCode of [
    "istanbul-layover",
    "istanbul-half-day",
    "istanbul-full-day",
    "sapanca",
    "bursa",
    "bosphorus-dinner",
  ]) {
    const applied = {
      ...baseDraft().applied,
      dropoff: emptyDropoff,
      distanceKm: 0,
      durationHours: tourCode === "bosphorus-dinner" ? null : 7,
    };
    assert.equal(
      validateDraftForCashCompletion(
        baseDraft({
          serviceType: "tour",
          tourCode,
          appliedVehicleCode:
            tourCode === "bosphorus-dinner" ? null : "business-minivan",
          selected: applied,
          applied,
        }),
      ),
      null,
      tourCode,
    );
  }
});

test("transfer completion still requires a dropoff", () => {
  const trip = {
    ...baseDraft().applied,
    dropoff: {
      nameCustomer: null,
      addressCustomer: null,
      nameTr: null,
      placeId: null,
      latitude: null,
      longitude: null,
      locationType: null,
      airportCode: null,
    },
  };
  assert.equal(
    validateDraftForCashCompletion(
      baseDraft({ selected: trip, applied: trip }),
    ),
    "dropoff",
  );
});

test("unapplied trip changes block completion", () => {
  const draft = baseDraft();
  draft.selected.passengerCount = 2;
  assert.equal(draftTripIsDirty(draft), true);
  assert.equal(validateDraftForCashCompletion(draft), "unapplied-changes");
});

test("unapplied hourly duration blocks completion", () => {
  const emptyDropoff = {
    nameCustomer: null,
    addressCustomer: null,
    nameTr: null,
    placeId: null,
    latitude: null,
    longitude: null,
    locationType: null,
    airportCode: null,
  };
  const applied = {
    pickup: emptyLocation(),
    dropoff: emptyDropoff,
    pickupAt: new Date("2026-08-28T10:00:00.000Z"),
    distanceKm: null,
    durationHours: 5,
    passengerCount: 1,
    luggageCount: 0,
    babySeatCount: 0,
    meetAndGreet: false,
    flightCode: null,
  };
  const draft = baseDraft({
    serviceType: "hourly",
    selected: { ...applied, durationHours: 8 },
    applied,
  });
  assert.equal(draftTripIsDirty(draft), true);
  assert.equal(validateDraftForCashCompletion(draft), "unapplied-changes");
});

test("primary passenger must be complete", () => {
  const passenger: CompletionPassenger = {
    sequenceNo: 1,
    firstName: "",
    lastName: "Test",
    countryCode: "TR",
    gender: "male",
    isPrimaryPassenger: true,
  };
  assert.equal(isPrimaryPassengerReady(passenger), false);
  assert.equal(
    validateDraftForCashCompletion(
      baseDraft({
        passengers: [passenger],
      }),
    ),
    "passenger",
  );
});

test("vehicle and checkout stage are required", () => {
  assert.equal(
    validateDraftForCashCompletion(baseDraft({ appliedVehicleCode: null })),
    "vehicle",
  );
  assert.equal(
    validateDraftForCashCompletion(baseDraft({ currentStage: "vehicle_selection" })),
    "checkout-stage",
  );
});
