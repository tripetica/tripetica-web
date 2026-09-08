import test from "node:test";
import assert from "node:assert/strict";
import {
  toPersistedLocation,
  UntrustedLocationError,
} from "@/lib/booking/location-persist";
import { airportPresetByCode } from "@/lib/booking/catalog";
import { emptyLocation, type LocationValue } from "@/lib/booking/types";

function googleLocation(overrides: Partial<LocationValue> = {}): LocationValue {
  return {
    source: "google",
    name: "Manipulated nearby address",
    formattedAddress: "Manipulated display address",
    placeId: "canonical-far-place",
    lat: 41.0001,
    lng: 29.0001,
    city: "İstanbul",
    district: "Beşiktaş",
    region: "İstanbul",
    country: "Türkiye",
    countryCode: "TR",
    airportCode: null,
    type: "place",
    placeTypes: ["street_address"],
    ...overrides,
  };
}

test("Google placeId replaces manipulated coordinates and visible address", async () => {
  const persisted = await toPersistedLocation(googleLocation(), "en", {
    async loadPlaceGeoDetails() {
      return {
        placeId: "canonical-far-place",
        name: "Canonical Far Hotel",
        formattedAddress: "Canonical far address, Antalya",
        lat: 36.9,
        lng: 30.7,
        city: "Antalya",
        district: "Muratpaşa",
        region: "Antalya",
        country: "Türkiye",
        countryCode: "TR",
        types: ["lodging"],
      };
    },
  });

  assert.equal(persisted.latitude, 36.9);
  assert.equal(persisted.longitude, 30.7);
  assert.equal(persisted.nameCustomer, "Canonical Far Hotel");
  assert.equal(persisted.addressCustomer, "Canonical far address, Antalya");
  assert.equal(persisted.provinceCode, "antalya");
});

test("airport preset ignores every client-controlled coordinate and label", async () => {
  const ist = airportPresetByCode("IST");
  const persisted = await toPersistedLocation(
    googleLocation({
      placeId: null,
      airportCode: "IST",
      type: "airport",
      lat: 0,
      lng: 0,
    }),
    "tr",
  );

  assert.equal(persisted.latitude, ist.lat);
  assert.equal(persisted.longitude, ist.lng);
  assert.equal(persisted.placeId, ist.placeId);
  assert.equal(persisted.nameCustomer, "İstanbul Havalimanı (IST)");
});

test("new non-empty location without placeId is rejected", async () => {
  await assert.rejects(
    toPersistedLocation(
      googleLocation({ source: "query", placeId: null, airportCode: null }),
      "tr",
    ),
    UntrustedLocationError,
  );
});

test("empty placeId-less form state remains usable", async () => {
  const empty = await toPersistedLocation(emptyLocation(), "tr");
  assert.equal(empty.latitude, null);
  assert.equal(empty.nameCustomer, null);
});
