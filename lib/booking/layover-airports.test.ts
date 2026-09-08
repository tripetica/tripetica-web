import test from "node:test";
import assert from "node:assert/strict";
import {
  layoverAirportCodeFromLocation,
  layoverBaseEur,
  normalizeLayoverTourLocations,
} from "@/lib/booking/layover-airports";
import { emptyLocation } from "@/lib/booking/types";

const airportLabels = {
  IST: "Istanbul Airport (IST)",
  SAW: "Sabiha Gokcen Airport (SAW)",
  AYT: "Antalya Airport (AYT)",
};

function airportLocation(code: "IST" | "SAW", name: string) {
  return {
    ...emptyLocation(),
    source: "preset" as const,
    type: "airport" as const,
    airportCode: code,
    name,
    lat: code === "IST" ? 41.26 : 40.9,
    lng: code === "IST" ? 28.74 : 29.31,
  };
}

test("layoverBaseEur matrix uses canonical IST/SAW codes", () => {
  assert.equal(layoverBaseEur("IST", "IST"), 140);
  assert.equal(layoverBaseEur("IST", "SAW"), 150);
  assert.equal(layoverBaseEur("SAW", "IST"), 150);
  assert.equal(layoverBaseEur("SAW", "SAW"), 160);
});

test("layoverAirportCodeFromLocation accepts only IST and SAW", () => {
  assert.equal(
    layoverAirportCodeFromLocation(airportLocation("IST", airportLabels.IST)),
    "IST",
  );
  assert.equal(
    layoverAirportCodeFromLocation(airportLocation("SAW", airportLabels.SAW)),
    "SAW",
  );
  assert.equal(
    layoverAirportCodeFromLocation({
      ...emptyLocation(),
      name: "Antalya",
      airportCode: "AYT",
      type: "airport",
    }),
    null,
  );
});

test("normalizeLayoverTourLocations clears invalid pickup", () => {
  const result = normalizeLayoverTourLocations(
    { ...emptyLocation(), name: "Taksim", placeId: "taksim" },
    airportLocation("IST", airportLabels.IST),
    airportLabels,
  );
  assert.equal(layoverAirportCodeFromLocation(result.pickup), null);
  assert.equal(layoverAirportCodeFromLocation(result.dropoff), null);
});

test("normalizeLayoverTourLocations syncs dropoff to pickup when dropoff invalid", () => {
  const pickup = airportLocation("SAW", airportLabels.SAW);
  const result = normalizeLayoverTourLocations(
    pickup,
    { ...emptyLocation(), name: "Taksim", placeId: "taksim" },
    airportLabels,
  );
  assert.equal(layoverAirportCodeFromLocation(result.pickup), "SAW");
  assert.equal(layoverAirportCodeFromLocation(result.dropoff), "SAW");
});

test("normalizeLayoverTourLocations preserves valid IST/SAW pair", () => {
  const result = normalizeLayoverTourLocations(
    airportLocation("IST", airportLabels.IST),
    airportLocation("SAW", airportLabels.SAW),
    airportLabels,
  );
  assert.equal(layoverAirportCodeFromLocation(result.pickup), "IST");
  assert.equal(layoverAirportCodeFromLocation(result.dropoff), "SAW");
});
