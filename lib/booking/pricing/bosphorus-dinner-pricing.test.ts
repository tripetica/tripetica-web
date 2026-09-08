import test from "node:test";
import assert from "node:assert/strict";
import {
  BOSPHORUS_DINNER_TOUR_CODE,
  BOSPHORUS_MEET_AND_GREET_FEE_EUR,
  bosphorusMeetAndGreetFeeEur,
  bosphorusEarliestBookingLocal,
  bosphorusHasBookablePax,
  bosphorusLocalDateTimeFromDate,
  bosphorusLineItems,
  evaluateBosphorusCheckoutDay,
  isBosphorusDinnerTour,
  quoteBosphorusDinnerTotalEur,
  quoteBosphorusDinnerPackageTotalEur,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";

test("bosphorus dinner detection", () => {
  assert.equal(isBosphorusDinnerTour("tour", BOSPHORUS_DINNER_TOUR_CODE), true);
  assert.equal(isBosphorusDinnerTour("tour", "bursa"), false);
});

test("bosphorus quote matches example totals", () => {
  assert.equal(
    quoteBosphorusDinnerTotalEur({
      adultSoft: 1,
      adultAlcohol: 1,
      child5to9: 1,
      child0to4: 1,
    }),
    150,
  );
  assert.equal(
    quoteBosphorusDinnerTotalEur({
      adultSoft: 2,
      adultAlcohol: 0,
      child5to9: 1,
      child0to4: 1,
    }),
    140,
  );
});

test("bosphorus meet and greet adds 5 EUR only for IST or SAW", () => {
  const counts = {
    adultSoft: 1,
    adultAlcohol: 0,
    child5to9: 0,
    child0to4: 0,
  };
  assert.equal(BOSPHORUS_MEET_AND_GREET_FEE_EUR, 5);
  assert.equal(bosphorusMeetAndGreetFeeEur("IST", true), 5);
  assert.equal(bosphorusMeetAndGreetFeeEur("saw", true), 5);
  assert.equal(bosphorusMeetAndGreetFeeEur("AYT", true), 0);
  assert.equal(bosphorusMeetAndGreetFeeEur("IST", false), 0);
  assert.equal(bosphorusMeetAndGreetFeeEur(null, true), 0);
  assert.equal(quoteBosphorusDinnerPackageTotalEur(counts, "IST", true), 55);
  assert.equal(quoteBosphorusDinnerPackageTotalEur(counts, "SAW", false), 50);
});

test("bosphorus line items skip zero quantities", () => {
  const lines = bosphorusLineItems({
    adultSoft: 2,
    adultAlcohol: 0,
    child5to9: 1,
    child0to4: 0,
  });
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.lineEur, 100);
});

test("bosphorus bookable pax requires an adult", () => {
  assert.equal(
    bosphorusHasBookablePax({
      adultSoft: 0,
      adultAlcohol: 0,
      child5to9: 0,
      child0to4: 0,
    }),
    false,
  );
  assert.equal(
    bosphorusHasBookablePax({
      adultSoft: 0,
      adultAlcohol: 0,
      child5to9: 0,
      child0to4: 1,
    }),
    false,
  );
  assert.equal(
    bosphorusHasBookablePax({
      adultSoft: 1,
      adultAlcohol: 0,
      child5to9: 0,
      child0to4: 0,
    }),
    true,
  );
  assert.equal(
    bosphorusLocalDateTimeFromDate("2026-09-15"),
    "2026-09-15T19:00",
  );
});

test("bosphorus same-day cutoff is after 17:30 Istanbul local", () => {
  assert.equal(
    bosphorusEarliestBookingLocal("2026-08-30T17:30"),
    "2026-08-30T19:00",
  );
  assert.equal(
    bosphorusEarliestBookingLocal("2026-08-30T17:31"),
    "2026-08-31T19:00",
  );
  assert.equal(
    bosphorusEarliestBookingLocal("2026-08-30T23:10"),
    "2026-08-31T19:00",
  );
});

test("bosphorus checkout day allows today through 17:30", () => {
  assert.deepEqual(
    evaluateBosphorusCheckoutDay("2026-08-30T19:00", "2026-08-30T17:29"),
    { ok: true },
  );
  assert.deepEqual(
    evaluateBosphorusCheckoutDay("2026-08-30T19:00", "2026-08-30T17:30"),
    { ok: true },
  );
});

test("bosphorus checkout day blocks today after 17:30 and suggests next day", () => {
  assert.deepEqual(
    evaluateBosphorusCheckoutDay("2026-08-30T19:00", "2026-08-30T17:31"),
    { ok: false, suggestedPickupAtLocal: "2026-08-31T19:00" },
  );
  assert.deepEqual(
    evaluateBosphorusCheckoutDay("2026-08-30T19:00", "2026-08-30T20:30"),
    { ok: false, suggestedPickupAtLocal: "2026-08-31T19:00" },
  );
  assert.deepEqual(
    evaluateBosphorusCheckoutDay("2026-08-31T19:00", "2026-08-30T20:30"),
    { ok: true },
  );
});
