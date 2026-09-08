import test from "node:test";
import assert from "node:assert/strict";
import { isHeroFormBasicsReady } from "@/lib/booking/hero-form-ready";
import { emptyLocation } from "@/lib/booking/types";

function filledLocation() {
  return {
    ...emptyLocation(),
    placeId: "test",
    name: "Test",
  };
}

test("transfer CTA ready when pickup, dropoff, and datetime are set", () => {
  assert.equal(
    isHeroFormBasicsReady({
      serviceType: "transfer",
      pickup: filledLocation(),
      dropoff: filledLocation(),
      durationHours: null,
      tourId: null,
      pickupAtLocal: "2026-08-30T14:00:00",
    }),
    true,
  );
});

test("transfer CTA incomplete when dropoff missing", () => {
  assert.equal(
    isHeroFormBasicsReady({
      serviceType: "transfer",
      pickup: filledLocation(),
      dropoff: emptyLocation(),
      durationHours: null,
      tourId: null,
      pickupAtLocal: "2026-08-30T14:00:00",
    }),
    false,
  );
});

test("hourly CTA does not require dropoff", () => {
  assert.equal(
    isHeroFormBasicsReady({
      serviceType: "hourly",
      pickup: filledLocation(),
      dropoff: emptyLocation(),
      durationHours: 4,
      tourId: null,
      pickupAtLocal: "2026-08-30T14:00:00",
    }),
    true,
  );
});

test("tour CTA requires tour selection", () => {
  assert.equal(
    isHeroFormBasicsReady({
      serviceType: "tour",
      pickup: filledLocation(),
      dropoff: null,
      durationHours: null,
      tourId: null,
      pickupAtLocal: "2026-08-30T14:00:00",
    }),
    false,
  );
});

test("non-layover tours accept a restored non-airport pickup", () => {
  for (const tourId of ["istanbul-half-day", "istanbul-full-day"] as const) {
    assert.equal(
      isHeroFormBasicsReady({
        serviceType: "tour",
        pickup: filledLocation(),
        dropoff: null,
        durationHours: null,
        tourId,
        pickupAtLocal: "2026-08-30T14:00:00",
      }),
      true,
    );
  }
});

function layoverAirport(code: "IST" | "SAW") {
  return {
    ...emptyLocation(),
    source: "preset" as const,
    type: "airport" as const,
    airportCode: code,
    name: code,
  };
}

test("istanbul layover CTA requires IST/SAW pickup and dropoff", () => {
  assert.equal(
    isHeroFormBasicsReady({
      serviceType: "tour",
      pickup: layoverAirport("IST"),
      dropoff: layoverAirport("IST"),
      durationHours: null,
      tourId: "istanbul-layover",
      pickupAtLocal: "2026-08-30T14:00:00",
    }),
    true,
  );
  assert.equal(
    isHeroFormBasicsReady({
      serviceType: "tour",
      pickup: filledLocation(),
      dropoff: layoverAirport("IST"),
      durationHours: null,
      tourId: "istanbul-layover",
      pickupAtLocal: "2026-08-30T14:00:00",
    }),
    false,
  );
});
