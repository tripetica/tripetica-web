import assert from "node:assert/strict";
import test from "node:test";
import { airportPresets } from "../catalog";
import {
  meetAndGreetMode,
  normalizeMeetAndGreet,
  pickupAirportCode,
  pickupIsAirport,
} from "../meet-and-greet";
import { classifyTransferLocation } from "./location-codes";
import { quoteTransferBase } from "./transfer-pricing";

test("classifies Istanbul the same in TR, EN, and RU", () => {
  const tr = classifyTransferLocation({
    city: "İstanbul",
    district: "Beyoğlu",
    region: "İstanbul",
    country: "Türkiye",
    countryCode: "TR",
  });
  const en = classifyTransferLocation({
    city: "Istanbul",
    district: "Beyoglu",
    region: "Istanbul Province",
    country: "Turkey",
    countryCode: "TR",
  });
  const ru = classifyTransferLocation({
    city: "Стамбул",
    district: "Бейоглу",
    region: "Стамбул",
    country: "Турция",
    countryCode: "TR",
  });
  assert.deepEqual(tr, { provinceCode: "istanbul", districtCode: "beyoglu" });
  assert.deepEqual(en, tr);
  assert.deepEqual(ru, tr);
});

test("maps Taksim neighborhood to Beyoglu without using formatted address", () => {
  const geo = classifyTransferLocation({
    city: "Istanbul",
    district: "Taksim",
    region: "Istanbul",
    countryCode: "TR",
  });
  assert.equal(geo.provinceCode, "istanbul");
  assert.equal(geo.districtCode, "beyoglu");
});

test("does not treat Istanbul Caddesi as Istanbul province", () => {
  const geo = classifyTransferLocation({
    city: "İstanbul Caddesi",
    district: null,
    region: "Bursa",
    country: "Türkiye",
    countryCode: "TR",
  });
  assert.equal(geo.provinceCode, "bursa");
  assert.equal(geo.districtCode, null);
});

test("classifies Sile as an Istanbul district", () => {
  const geo = classifyTransferLocation({
    city: "Şile",
    district: "Şile",
    region: "İstanbul",
    countryCode: "TR",
  });
  assert.equal(geo.provinceCode, "istanbul");
  assert.equal(geo.districtCode, "sile");
});

test("Russian Sile alias maps to canonical district code", () => {
  const geo = classifyTransferLocation({
    region: "Стамбул",
    district: "Шиле",
    country: "Турция",
  });
  assert.equal(geo.provinceCode, "istanbul");
  assert.equal(geo.districtCode, "sile");
});

test("non-TR country codes are outside Istanbul", () => {
  const geo = classifyTransferLocation({
    city: "Istanbul",
    region: "Istanbul",
    countryCode: "BG",
  });
  assert.equal(geo.provinceCode, "other");
});

test("Cyrillic Istanbul is not charged the outside-Istanbul surcharge", () => {
  const geo = classifyTransferLocation({
    region: "Стамбул",
    district: "Бейоглу",
    country: "Турция",
  });
  const quote = quoteTransferBase({
    distanceKm: 43.8,
    pickupAtLocal: "2026-08-27T22:50:00",
    pickup: { provinceCode: "istanbul", districtCode: "arnavutkoy" },
    dropoff: geo,
  });
  assert.equal(quote.locationSurchargeEur, 0);
  assert.equal(quote.dropoffProvinceCode, "istanbul");
});

test("meet and greet is hidden and forced off away from airports", () => {
  const pickup = {
    type: "place" as const,
    airportCode: null,
    placeId: "ChIJtaksim",
    placeTypes: ["lodging"],
  };
  assert.equal(pickupIsAirport(pickup), false);
  assert.equal(meetAndGreetMode(pickup), "hidden");
  assert.equal(normalizeMeetAndGreet(pickup, true), false);
});

test("IST meet and greet stays optional", () => {
  const ist = airportPresets.find((preset) => preset.id === "IST");
  assert.ok(ist);
  const pickup = {
    type: "airport" as const,
    airportCode: null,
    placeId: ist.placeId,
    placeTypes: ["airport"],
  };
  assert.equal(pickupAirportCode(pickup), "IST");
  assert.equal(meetAndGreetMode(pickup), "optional");
  assert.equal(normalizeMeetAndGreet(pickup, false), false);
  assert.equal(normalizeMeetAndGreet(pickup, true), true);
});

test("AYT meet and greet is required even if the client sends false", () => {
  const ayt = airportPresets.find((preset) => preset.id === "AYT");
  assert.ok(ayt);
  const pickup = {
    type: "airport" as const,
    airportCode: null,
    placeId: ayt.placeId,
    placeTypes: ["airport"],
  };
  assert.equal(pickupAirportCode(pickup), "AYT");
  assert.equal(meetAndGreetMode(pickup), "required");
  assert.equal(normalizeMeetAndGreet(pickup, false), true);
  assert.equal(normalizeMeetAndGreet(pickup, null), true);
});
