import test from "node:test";
import assert from "node:assert/strict";
import {
  canSelectVehicle,
  hasUnappliedTripChanges,
  locationsRepresentSamePlace,
  type BookingTripView,
} from "@/lib/booking/draft-view";
import { emptyLocation, type LocationValue } from "@/lib/booking/types";

function place(overrides: Partial<LocationValue> = {}): LocationValue {
  return {
    ...emptyLocation(),
    placeId: "ChIJ_test",
    lat: 41.2753,
    lng: 28.7519,
    name: "Istanbul Airport",
    formattedAddress: "Istanbul Airport, Turkey",
    airportCode: "IST",
    type: "airport",
    ...overrides,
  };
}

function trip(overrides: Partial<BookingTripView> = {}): BookingTripView {
  return {
    pickup: emptyLocation(),
    dropoff: emptyLocation(),
    pickupAtLocal: "2026-08-27T12:00:00",
    distanceKm: 18.4,
    durationHours: null,
    passengerCount: 6,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: false,
    flightCode: null,
    bursaRoute: null,
    bosphorusPax: null,
    ...overrides,
  };
}

test("vehicle select stays blocked until applied passenger count is set", () => {
  const unset = trip({ passengerCount: 0 });
  const pending = trip({ passengerCount: 7 });
  assert.equal(canSelectVehicle(unset, unset), false);
  assert.equal(canSelectVehicle(pending, trip({ passengerCount: 0 })), false);
  assert.equal(hasUnappliedTripChanges(pending, trip({ passengerCount: 0 })), true);
});

test("vehicle select is allowed only when selected equals applied", () => {
  const applied = trip({ passengerCount: 7 });
  assert.equal(canSelectVehicle(applied, applied), true);
  assert.equal(hasUnappliedTripChanges(applied, applied), false);
});

test("unapplied occupancy, extras, and route fields block vehicle select", () => {
  const applied = trip({
    passengerCount: 7,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: false,
    flightCode: "TK123",
  });
  const cases: BookingTripView[] = [
    { ...applied, passengerCount: 3 },
    { ...applied, luggageCount: 4 },
    { ...applied, babySeatCount: 1 },
    { ...applied, meetAndGreet: true },
    { ...applied, flightCode: "PC321" },
    { ...applied, tourCode: "istanbul-half-day" },
    { ...applied, pickupAtLocal: "2026-08-28T09:00:00" },
    { ...applied, distanceKm: 22 },
    { ...applied, durationHours: 8 },
    { ...applied, pickup: { ...applied.pickup, name: "IST" } },
    { ...applied, dropoff: { ...applied.dropoff, name: "Taksim" } },
  ];
  for (const selected of cases) {
    assert.equal(hasUnappliedTripChanges(selected, applied), true);
    assert.equal(canSelectVehicle(selected, applied), false);
  }
});

test("hourly blank dropoffs are not treated as dirty differences", () => {
  const applied = trip({
    distanceKm: null,
    durationHours: 5,
    passengerCount: 2,
    dropoff: emptyLocation(),
  });
  const selected = trip({
    distanceKm: null,
    durationHours: 5,
    passengerCount: 2,
    dropoff: emptyLocation(),
  });
  assert.equal(hasUnappliedTripChanges(selected, applied), false);
});

test("durationHours difference marks trip dirty", () => {
  const applied = trip({ distanceKm: null, durationHours: 5, passengerCount: 2 });
  const selected = trip({ distanceKm: null, durationHours: 8, passengerCount: 2 });
  assert.equal(hasUnappliedTripChanges(selected, applied), true);
});

test("locationsRepresentSamePlace matches by placeId first", () => {
  const a = place({ placeId: "abc", name: "Label A" });
  const b = place({ placeId: "abc", name: "Label B", formattedAddress: "Other" });
  assert.equal(locationsRepresentSamePlace(a, b), true);
  assert.equal(
    locationsRepresentSamePlace(a, place({ placeId: "xyz" })),
    false,
  );
});

test("locationsRepresentSamePlace matches by airport code when placeId missing", () => {
  const a = place({ placeId: null, airportCode: "IST", lat: null, lng: null });
  const b = place({ placeId: null, airportCode: "IST", lat: null, lng: null });
  assert.equal(locationsRepresentSamePlace(a, b), true);
  assert.equal(
    locationsRepresentSamePlace(a, place({ placeId: null, airportCode: "SAW" })),
    false,
  );
});

test("locationsRepresentSamePlace matches by coordinates when ids absent", () => {
  const a = place({
    placeId: null,
    airportCode: null,
    lat: 41.0082,
    lng: 28.9784,
  });
  const b = place({
    placeId: null,
    airportCode: null,
    lat: 41.0082,
    lng: 28.9784,
    name: "Taksim",
  });
  assert.equal(locationsRepresentSamePlace(a, b), true);
  assert.equal(locationsRepresentSamePlace(a, emptyLocation()), false);
});
