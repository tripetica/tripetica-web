import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  mergeDhmiBoards,
  parseAllFlightsList,
  parseUcusizleAirports,
  parseUcusizleFlights,
} from "@/lib/ops/flight-tracking-dhmi";
import { resolvedActualArrivalMs } from "@/lib/ops/flight-tracking";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("ucusizle airport list maps IATA codes including IST/SAW/AYT", () => {
  const map = parseUcusizleAirports({
    data: JSON.stringify([
      { airportId: 57, iataCode: "IST", name: "İstanbul Havalimanı" },
      { airportId: 999, iataCode: "SAW", name: "Sabiha" },
      { airportId: 4, iataCode: "AYT", name: "Antalya" },
    ]),
  });
  assert.equal(map.get("IST"), 57);
  assert.equal(map.get("SAW"), 999);
  assert.equal(map.get("AYT"), 4);
});

test("ucusizle exactTime is kept as actual and is not replaced by estimated", () => {
  const flights = parseUcusizleFlights({
    data: JSON.stringify([
      {
        flightCode: "UA9062",
        flightDate: "16.09.2026",
        scheduledTime: "16.09.2026 21:15:00",
        estimatedTime: "16.09.2026 21:18:00",
        exactTime: "2114",
        flightStatus: "İNDİ - LANDED",
        flightStatusId: 17,
      },
    ]),
  });
  assert.equal(flights[0]?.exactTime, "2114");
  const actual = resolvedActualArrivalMs(flights[0]!);
  assert.ok(actual);
  assert.notEqual(new Date(actual).getUTCHours() === 18 && new Date(actual).getUTCMinutes() === 18, true);
});

test("AllFlights JSON has no exactTime field and merge prefers ucusizle actual", () => {
  const allFlights = parseAllFlightsList([
    {
      Number: "UA9062",
      Date: "16.09.2026",
      Planned: "21:15",
      Estimated: "21:18",
      Status: "İNDİ - LANDED",
    },
  ]);
  assert.equal(allFlights[0]?.exactTime, null);
  const merged = mergeDhmiBoards(
    [
      {
        number: "UA9062",
        date: "16.09.2026",
        planned: "21:15",
        estimated: "21:18",
        exactTime: "2114",
        status: "İNDİ - LANDED",
        statusId: 17,
      },
    ],
    allFlights,
  );
  assert.equal(merged[0]?.exactTime, "2114");
});

test("unexpected DHMİ payload throws without inventing flights", () => {
  assert.throws(() => parseUcusizleFlights({ data: "{not-json" }), /unexpected_dhmi_payload/);
  assert.throws(() => parseAllFlightsList({ flights: [] }), /unexpected_dhmi_payload/);
});

test("DHMİ client does not live in the driver-task browser module", () => {
  const screen = source("components/driver-task/driver-task-screen.tsx");
  assert.doesNotMatch(screen, /flightwebsvc|ucusizle|dhmi\.gov/);
});
