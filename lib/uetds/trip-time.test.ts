import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { resolveOfficialUetdsLocation } from "@/lib/uetds/official-locations";
import {
  adjustUetdsTripTimesForSubmit,
  applyManualUetdsTripDefaults,
  applyUetdsAiExtractionTripTimes,
  applyUetdsStartToEnd,
  defaultUetdsEndFromStart,
  isUetdsAirportPickup,
  isUetdsEndAfterStart,
  UETDS_DEFAULT_START_LEAD_MS,
  UETDS_SUBMIT_ADJUST_LEAD_MS,
  UETDS_SUBMIT_MIN_REMAINING_MS,
  uetdsMinimumStart,
  uetdsStartRemainingMs,
  uetdsTripTimeIssues,
} from "@/lib/uetds/trip-time";
import { blockingUetdsDraftIssues, createEmptyDraft, parseUetdsDraft } from "@/lib/uetds/draft";
import {
  canAccessUetdsFormDraft,
  isUetdsFormDraftExpired,
  shouldDeleteUetdsFormDraftAfterMinistry,
  UETDS_FORM_DRAFT_TTL_MS,
} from "@/lib/uetds/form-draft-policy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("1: 20 Sep 10:00 Istanbul default start is 11:05 same day", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:00");
  const minimum = uetdsMinimumStart(now);
  assert.equal(minimum.date, "2026-09-20");
  assert.equal(minimum.time, "11:05");
  assert.equal(minimum.local, "2026-09-20T11:05");
});

test("2: 20 Sep 23:30 Istanbul default start rolls to 21 Sep 00:35", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T23:30");
  const minimum = uetdsMinimumStart(now);
  assert.equal(minimum.date, "2026-09-21");
  assert.equal(minimum.time, "00:35");
});

test("C/D: automatic end is +3h at an airport and +2h elsewhere, including midnight", () => {
  const street = defaultUetdsEndFromStart("2026-09-21", "03:00");
  assert.equal(street.date, "2026-09-21");
  assert.equal(street.time, "05:00");
  const streetNight = defaultUetdsEndFromStart("2026-09-21", "23:00");
  assert.equal(streetNight.date, "2026-09-22");
  assert.equal(streetNight.time, "01:00");
  const airport = defaultUetdsEndFromStart("2026-09-21", "03:00", true);
  assert.equal(airport.time, "06:00");
  const airportNight = defaultUetdsEndFromStart("2026-09-21", "23:00", true);
  assert.equal(airportNight.date, "2026-09-22");
  assert.equal(airportNight.time, "02:00");
});

test("3: 70 minutes remaining keeps the start and recomputes an automatic non-airport end to +2h", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:00");
  assert.equal(uetdsStartRemainingMs("2026-09-20", "11:10", now), 70 * 60 * 1000);
  const next = adjustUetdsTripTimesForSubmit(
    {
      startDate: "2026-09-20",
      startTime: "11:10",
      endDate: "2026-09-20",
      endTime: "14:10",
      endManual: false,
    },
    now,
  );
  assert.equal(next.startAdjusted, false);
  assert.equal(next.endAdjusted, true);
  assert.equal(next.startTime, "11:10");
  assert.equal(next.endTime, "13:10");
});

test("3b: an end under the pickup minimum is raised only to that minimum", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:00");
  const street = adjustUetdsTripTimesForSubmit(
    {
      startDate: "2026-09-20",
      startTime: "11:10",
      endDate: "2026-09-20",
      endTime: "11:20",
      endManual: true,
    },
    now,
  );
  assert.equal(street.startAdjusted, false);
  assert.equal(street.endAdjusted, true);
  assert.equal(street.endTime, "11:40");
  const airport = adjustUetdsTripTimesForSubmit(
    {
      startDate: "2026-09-20",
      startTime: "11:10",
      endDate: "2026-09-20",
      endTime: "11:20",
      endManual: true,
      airportPickup: true,
    },
    now,
  );
  assert.equal(airport.endTime, "12:10");
  assert.equal(airport.endAdjusted, true);
});

test("4: 56 minutes remaining auto-adjusts start to now + 62 minutes", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:04");
  assert.equal(uetdsStartRemainingMs("2026-09-20", "11:00", now), 56 * 60 * 1000);
  const next = adjustUetdsTripTimesForSubmit(
    {
      startDate: "2026-09-20",
      startTime: "11:00",
      endDate: "2026-09-20",
      endTime: "14:00",
      endManual: false,
    },
    now,
  );
  assert.equal(next.startAdjusted, true);
  assert.equal(next.startDate, "2026-09-20");
  assert.equal(next.startTime, "11:06");
  assert.equal(next.endAdjusted, true);
  assert.equal(next.endTime, "13:06");
});

test("5: automatic start adjustment raises only an end that falls under the new minimum", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:04");
  const next = adjustUetdsTripTimesForSubmit(
    {
      startDate: "2026-09-20",
      startTime: "11:00",
      endDate: "2026-09-20",
      endTime: "11:20",
      endManual: true,
    },
    now,
  );
  assert.equal(next.startTime, "11:06");
  assert.equal(next.endDate, "2026-09-20");
  assert.equal(next.endTime, "11:36");
  assert.equal(next.endAdjusted, true);
});

test("6: automatic start adjustment keeps a still-valid later end", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:04");
  const next = adjustUetdsTripTimesForSubmit(
    {
      startDate: "2026-09-20",
      startTime: "11:00",
      endDate: "2026-09-20",
      endTime: "16:00",
      endManual: true,
    },
    now,
  );
  assert.equal(next.startTime, "11:06");
  assert.equal(next.endTime, "16:00");
  assert.equal(next.endAdjusted, false);
});

test("7: restored stale start is not a form-blocking error", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:04");
  const draft = createEmptyDraft("manual", { applyTripDefaults: false });
  draft.startDate = "2026-09-20";
  draft.startTime = "11:00";
  draft.endDate = "2026-09-20";
  draft.endTime = "14:00";
  assert.equal(uetdsTripTimeIssues(draft).includes("startTooSoon"), false);
  assert.equal(blockingUetdsDraftIssues(draft).includes("startTooSoon"), false);
  const next = adjustUetdsTripTimesForSubmit(draft, now);
  assert.equal(next.startAdjusted, true);
  assert.equal(next.startTime, "11:06");
});

test("submit example: 15:05/18:05 waiting until 14:30 bumps start to 15:32 and keeps the later end", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T14:30");
  const next = adjustUetdsTripTimesForSubmit(
    {
      startDate: "2026-09-20",
      startTime: "15:05",
      endDate: "2026-09-20",
      endTime: "18:05",
      endManual: true,
    },
    now,
  );
  assert.equal(next.startTime, "15:32");
  assert.equal(next.endTime, "18:05");
  assert.equal(next.startAdjusted, true);
  assert.equal(next.endAdjusted, false);
});

test("submit example: 15:05/22:00 waiting until 14:30 bumps start only; end stays", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T14:30");
  const next = adjustUetdsTripTimesForSubmit(
    {
      startDate: "2026-09-20",
      startTime: "15:05",
      endDate: "2026-09-20",
      endTime: "22:00",
      endManual: true,
    },
    now,
  );
  assert.equal(next.startTime, "15:32");
  assert.equal(next.endTime, "22:00");
  assert.equal(next.endAdjusted, false);
});

test("E: later manual end is kept when start still leaves it valid", () => {
  const next = applyUetdsStartToEnd({
    startDate: "2026-09-21",
    startTime: "03:00",
    endDate: "2026-09-21",
    endTime: "08:30",
    endManual: true,
  });
  assert.equal(next.endDate, "2026-09-21");
  assert.equal(next.endTime, "08:30");
  assert.equal(isUetdsEndAfterStart("2026-09-21", "03:00", "2026-09-21", "08:30"), true);
});

test("manual default start is now + 65 minutes and a blank pickup ends +2 hours later", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:00");
  const defaults = applyManualUetdsTripDefaults(now);
  assert.equal(defaults.startDate, "2026-09-20");
  assert.equal(defaults.startTime, "11:05");
  assert.equal(defaults.endDate, "2026-09-20");
  assert.equal(defaults.endTime, "13:05");
  assert.equal(defaults.endManual, false);
});

test("invalidated manual end is recomputed to start + 3 hours", () => {
  const invalidated = applyUetdsStartToEnd({
    startDate: "2026-09-21",
    startTime: "09:00",
    endDate: "2026-09-21",
    endTime: "08:00",
    endManual: true,
  });
  assert.equal(invalidated.endDate, "2026-09-21");
  assert.equal(invalidated.endTime, "12:00");
});

test("AI/prefill trip times: missing start → now+65; missing end uses +2h and a short explicit end uses +30m", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:00");
  assert.equal(UETDS_DEFAULT_START_LEAD_MS, 65 * 60 * 1000);
  assert.equal(UETDS_SUBMIT_MIN_REMAINING_MS, 62 * 60 * 1000);
  assert.equal(UETDS_SUBMIT_ADJUST_LEAD_MS, 62 * 60 * 1000);

  const missingStart = applyUetdsAiExtractionTripTimes(
    { startDate: "", startTime: "", endDate: "", endTime: "" },
    now,
  );
  assert.equal(missingStart.startTime, "11:05");
  assert.equal(missingStart.endTime, "13:05");
  assert.equal(missingStart.startFromFallback, true);

  const keepSourceStart = applyUetdsAiExtractionTripTimes(
    { startDate: "2026-09-20", startTime: "15:05", endDate: "", endTime: "" },
    now,
  );
  assert.equal(keepSourceStart.startTime, "15:05");
  assert.equal(keepSourceStart.endTime, "17:05");
  assert.equal(keepSourceStart.startFromFallback, false);

  const shortEnd = applyUetdsAiExtractionTripTimes(
    { startDate: "2026-09-20", startTime: "15:05", endDate: "2026-09-20", endTime: "15:20" },
    now,
  );
  assert.equal(shortEnd.endTime, "15:35");
  assert.equal(shortEnd.endAdjusted, true);

  const longEnd = applyUetdsAiExtractionTripTimes(
    { startDate: "2026-09-20", startTime: "15:05", endDate: "2026-09-20", endTime: "22:00" },
    now,
  );
  assert.equal(longEnd.endTime, "22:00");
  assert.equal(longEnd.endAdjusted, false);
});

test("create-submit uses adjustUetdsTripTimesForSubmit before ministry payload", () => {
  assert.match(source("lib/uetds/submit.ts"), /adjustUetdsTripTimesForSubmit/);
  assert.match(source("lib/uetds/submit.ts"), /timeAdjustment\.startDate/);
  assert.match(source("lib/uetds/ai-extraction-schema.ts"), /applyUetdsAiExtractionTripTimes/);
  assert.doesNotMatch(source("lib/uetds/trip-time.ts"), /61 \* 60 \* 1000/);
});

test("I/J: draft is deleted only after ministry SUCCESS", () => {
  assert.equal(shouldDeleteUetdsFormDraftAfterMinistry("submitted"), true);
  assert.equal(shouldDeleteUetdsFormDraftAfterMinistry("failed"), false);
  assert.equal(shouldDeleteUetdsFormDraftAfterMinistry("partial"), false);
});

test("H: another authenticated user cannot access the previous draft", () => {
  const row = {
    actorType: "partner" as const,
    actorUserId: "11111111-1111-1111-1111-111111111111",
    partnerId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    createdAtMs: Date.now(),
  };
  assert.equal(
    canAccessUetdsFormDraft(row, {
      type: "partner",
      userId: "22222222-2222-2222-2222-222222222222",
      partnerId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    }),
    false,
  );
  assert.equal(
    canAccessUetdsFormDraft(row, {
      type: "partner",
      userId: row.actorUserId,
      partnerId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    }),
    false,
  );
  assert.equal(
    canAccessUetdsFormDraft(row, {
      type: "partner",
      userId: row.actorUserId,
      partnerId: row.partnerId,
    }),
    true,
  );
});

test("K: draft older than 12 hours cannot be restored", () => {
  const createdAtMs = Date.parse("2026-09-20T00:00:00.000Z");
  assert.equal(isUetdsFormDraftExpired(createdAtMs, createdAtMs + UETDS_FORM_DRAFT_TTL_MS - 1), false);
  assert.equal(isUetdsFormDraftExpired(createdAtMs, createdAtMs + UETDS_FORM_DRAFT_TTL_MS), true);
});

test("G/L: stored draft keeps canonical locations and hides technical UI", () => {
  const location = resolveOfficialUetdsLocation({
    details: {
      name: "Hilton Istanbul Bomonti",
      formattedAddress: "Silahşör Cad., Şişli/İstanbul",
      region: "İstanbul",
      district: "Şişli",
      countryCode: "TR",
      types: ["lodging"],
    },
  });
  const draft = createEmptyDraft("manual", { applyTripDefaults: false });
  draft.originLocation = location;
  const restored = parseUetdsDraft(JSON.parse(JSON.stringify(draft)));
  assert.equal(restored?.originLocation.provinceCode, "34");
  assert.equal(restored?.originLocation.districtOrAirportCode, "1663");
  const field = source("components/uetds/uetds-location-field.tsx");
  assert.match(field, /uetds-official-line/);
  assert.match(field, /officialConfirmed/);
  assert.doesNotMatch(field, /correctOfficial/);
  assert.doesNotMatch(field, /uetds-location-manual/);
  assert.doesNotMatch(field, /applyOfficialLocationSelection/);
  assert.doesNotMatch(field, /uetds-manual-toggle/);
  assert.match(field, /locationUnresolved/);
  assert.match(field, /uetds-location-search/);
  assert.match(source("lib/uetds/ministry-submit.ts"), /baslangicIlce/);
  assert.match(source("lib/uetds/ministry-submit.ts"), /uetdsMinistryYerText/);
});

test("8/9: Places menu is anchored to the search input wrapper", () => {
  const field = source("components/uetds/uetds-location-field.tsx");
  assert.match(field, /uetds-location-search/);
  assert.match(field, /uetds-location-menu/);
  const css = source("app/globals.css");
  assert.match(css, /\.uetds-location-search \{[\s\S]*position:\s*relative/);
  assert.match(css, /\.uetds-location-menu \{[\s\S]*position:\s*absolute/);
});

test("draft store keeps created_at TTL and strips credentials", () => {
  const sql = source("db/migrations/057_uetds_form_drafts.sql");
  assert.match(sql, /created_at \+ 12 hours|INTERVAL '12 hours'/);
  assert.match(sql, /Autosave updates must not change this value/);
  assert.match(source("lib/uetds/form-drafts.ts"), /created_at <= NOW\(\) - INTERVAL '12 hours'/);
  assert.doesNotMatch(source("lib/uetds/form-drafts.ts"), /created_at = NOW\(\)|created_at = EXCLUDED/);
  assert.match(source("lib/uetds/submit.ts"), /shouldDeleteUetdsFormDraftAfterMinistry/);
  assert.match(source("lib/uetds/submit.ts"), /blockingUetdsDraftIssues/);
  assert.match(source("lib/uetds/submit.ts"), /adjustUetdsTripTimesForSubmit/);
  assert.doesNotMatch(source("lib/uetds/form-drafts.ts"), /localStorage/);
  const parsed = parseUetdsDraft({
    source: "manual",
    passengers: [],
    password: "secret",
    test_password_sealed: "nope",
    originLocation: { provinceCode: "34", districtOrAirportCode: "1663", locationType: "district", countryCode: "TR", provinceName: "İSTANBUL", districtOrAirportName: "ŞİŞLİ", placeName: "Hilton", review: false },
  });
  assert.equal(parsed?.source, "manual");
  assert.equal(JSON.stringify(parsed).includes("secret"), false);
});

for (const start of ["", "01:15", "04:50", "05:04", "05:05", "07:00"]) {
  for (const end of ["", "07:00", "08:05", "10:30"]) {
    test(`AI minimums: document ${start || "missing"}/${end || "missing"}`, () => {
      const actual = applyUetdsAiExtractionTripTimes({
        startDate: start ? "2026-09-22" : "", startTime: start,
        endDate: end ? "2026-09-22" : "", endTime: end,
      }, istanbulLocalToUtcMs("2026-09-22T04:00"));
      const appliedStart = start >= "05:05" ? start : "05:05";
      const [hour, minute] = appliedStart.split(":").map(Number);
      const automatic = hour * 60 + minute + 120;
      const minimum = hour * 60 + minute + 30;
      const chosen = end
        ? Math.max(Number(end.slice(0, 2)) * 60 + Number(end.slice(3)), minimum)
        : automatic;
      const expected = `${String(Math.floor(chosen / 60)).padStart(2, "0")}:${String(chosen % 60).padStart(2, "0")}`;
      assert.equal(actual.startTime, appliedStart);
      assert.equal(actual.endTime, expected);
      assert.equal(actual.startDate, "2026-09-22");
      assert.equal(actual.endDate, "2026-09-22");
    });
  }
}

for (const [date, nextDate] of [["2026-09-22", "2026-09-23"], ["2026-09-30", "2026-10-01"], ["2026-12-31", "2027-01-01"]]) {
  test(`AI and submit full datetime rollover ${date}`, () => {
    const now = istanbulLocalToUtcMs(`${date}T23:30`);
    const input = { startDate: date, startTime: "23:00", endDate: date, endTime: "23:59", endManual: true };
    const ai = applyUetdsAiExtractionTripTimes(input, now);
    assert.equal(ai.startDate, nextDate);
    assert.equal(ai.startTime, "00:35");
    assert.equal(ai.endDate, nextDate);
    assert.equal(ai.endTime, "01:05");
    const submit = adjustUetdsTripTimesForSubmit(input, now);
    assert.equal(submit.startDate, nextDate);
    assert.equal(submit.startTime, "00:32");
    assert.equal(submit.endDate, nextDate);
    assert.equal(submit.endTime, "01:02");
  });
}

for (const start of ["06:05", "06:11", "06:12", "07:00"]) {
  for (const end of ["08:30", "09:12", "11:30"]) {
    test(`submit +62/+3h boundary ${start}/${end}`, () => {
      const actual = adjustUetdsTripTimesForSubmit({
        startDate: "2026-09-22", startTime: start,
        endDate: "2026-09-22", endTime: end, endManual: true,
      }, istanbulLocalToUtcMs("2026-09-22T05:10"));
      const finalStart = start >= "06:12" ? start : "06:12";
      assert.equal(actual.startTime, finalStart);
      assert.equal(actual.startAdjusted, start < "06:12");
      assert.equal(actual.endTime, end);
    });
  }
}

test("one-minute form review preserves AI +65 start; fractional minutes round safely", () => {
  const now = istanbulLocalToUtcMs("2026-09-22T05:00");
  const ai = applyUetdsAiExtractionTripTimes({ startDate: "", startTime: "", endDate: "", endTime: "" }, now);
  const result = adjustUetdsTripTimesForSubmit({ ...ai, endManual: false }, now + 60_000);
  assert.equal(result.startTime, "06:05");
  assert.equal(result.endTime, "08:05");
  assert.equal(result.startAdjusted, false);
  const rounded = applyUetdsAiExtractionTripTimes({ startDate: "", startTime: "", endDate: "", endTime: "" }, now + 1_000);
  assert.equal(rounded.startTime, "06:06");
  assert.equal(rounded.endTime, "08:06");
});

test("new notification pickup end rules keep a valid manual end and have no maximum", () => {
  const airportAuto = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "23:00", endManual: false, airportPickup: true,
  });
  assert.equal(airportAuto.endTime, "23:00");
  const airportHour = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "21:00", endManual: true, airportPickup: true,
  });
  assert.equal(airportHour.endTime, "21:00");
  assert.equal(airportHour.raisedToMinimum, false);
  const airportTooSoon = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "20:59", endManual: true, airportPickup: true,
  });
  assert.equal(airportTooSoon.endTime, "21:00");
  assert.equal(airportTooSoon.raisedToMinimum, true);

  const streetAuto = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "22:00", endManual: false, airportPickup: false,
  });
  assert.equal(streetAuto.endTime, "22:00");
  const streetHalf = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "20:30", endManual: true, airportPickup: false,
  });
  assert.equal(streetHalf.endTime, "20:30");
  const streetTooSoon = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "20:29", endManual: true, airportPickup: false,
  });
  assert.equal(streetTooSoon.endTime, "20:30");
  assert.equal(streetTooSoon.raisedToMinimum, true);

  const airportMidnight = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "22:30", endDate: "", endTime: "", endManual: false, airportPickup: true,
  });
  assert.equal(airportMidnight.endDate, "2026-10-09");
  assert.equal(airportMidnight.endTime, "01:30");
  const streetMidnight = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "23:15", endDate: "", endTime: "", endManual: false, airportPickup: false,
  });
  assert.equal(streetMidnight.endDate, "2026-10-09");
  assert.equal(streetMidnight.endTime, "01:15");

  const longTrip = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-09", endTime: "02:00", endManual: true, airportPickup: true,
  });
  assert.equal(longTrip.endDate, "2026-10-09");
  assert.equal(longTrip.endTime, "02:00");
  assert.equal(longTrip.raisedToMinimum, false);

  const keptAfterStartChange = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:30", endDate: "2026-10-08", endTime: "22:00", endManual: true, airportPickup: true,
  });
  assert.equal(keptAfterStartChange.endTime, "22:00");
  const recalculated = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "21:00", endDate: "2026-10-08", endTime: "23:00", endManual: false, airportPickup: false,
  });
  assert.equal(recalculated.endTime, "23:00");
  const switchedToAirport = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "20:40", endManual: true, airportPickup: true,
  });
  assert.equal(switchedToAirport.endTime, "21:00");
  const switchedToStreet = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "23:00", endManual: false, airportPickup: false,
  });
  assert.equal(switchedToStreet.endTime, "22:00");

  const now = istanbulLocalToUtcMs("2026-10-08T18:00");
  assert.equal(uetdsMinimumStart(now).time, "19:05");
  const document = applyUetdsAiExtractionTripTimes({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-09", endTime: "02:00",
  }, now, true);
  assert.equal(document.startTime, "20:00");
  assert.equal(document.endDate, "2026-10-09");
  assert.equal(document.endTime, "02:00");
  assert.equal(document.endManual, true);
  assert.equal(document.endAdjusted, false);
  const missingDocumentEnd = applyUetdsAiExtractionTripTimes({
    startDate: "2026-10-08", startTime: "20:00", endDate: "", endTime: "",
  }, now, true);
  assert.equal(missingDocumentEnd.endTime, "23:00");
  assert.equal(missingDocumentEnd.endManual, false);

  const submitted = adjustUetdsTripTimesForSubmit({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-09", endTime: "02:00", endManual: true, airportPickup: true,
  }, now);
  assert.equal(submitted.startTime, "20:00");
  assert.equal(submitted.endDate, "2026-10-09");
  assert.equal(submitted.endTime, "02:00");
  assert.equal(submitted.endAdjusted, false);
  assert.equal(isUetdsAirportPickup({ locationType: "airport" }), true);
  assert.equal(isUetdsAirportPickup({ locationType: "district" }), false);
  assert.match(source("lib/uetds/ministry-submit.ts"), /seferBitisSaati", input\.draft\.endTime/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /endMinimumAirport/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /ensureUetdsMinimumEnd/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /role="status"/);
  assert.doesNotMatch(source("components/uetds/uetds-notification-form.tsx"), /max=\{/);
});

test("screen regressions: airport parking is +3h and a manual end below the minimum snaps", () => {
  const parking = resolveOfficialUetdsLocation({
    placeName: "İstanbul Havalimanı Otopark",
    details: {
      name: "İstanbul Havalimanı Otopark",
      region: "İstanbul",
      district: "Arnavutköy",
      countryCode: "TR",
      types: ["parking", "point_of_interest"],
    },
  });
  const sisli = resolveOfficialUetdsLocation({
    placeName: "Şişli",
    details: { name: "Şişli", region: "İstanbul", countryCode: "TR", types: ["locality"] },
  });
  const airportDropoff = resolveOfficialUetdsLocation({ placeName: "İstanbul Havalimanı" });
  assert.equal(isUetdsAirportPickup(parking), true);
  assert.equal(parking.districtOrAirportCode, "99157");
  assert.equal(isUetdsAirportPickup(sisli), false);
  assert.equal(isUetdsAirportPickup({ locationType: "district", placeName: "IST" }), true);
  assert.equal(isUetdsAirportPickup({ locationType: "district", placeName: "SAW" }), true);
  assert.equal(isUetdsAirportPickup({ locationType: "district", placeName: "AYT" }), true);
  assert.equal(isUetdsAirportPickup({ locationType: "district", placeName: "Sabiha Gökçen" }), true);
  assert.equal(isUetdsAirportPickup({ locationType: "district", placeName: "Antalya Havalimanı" }), true);
  assert.equal(isUetdsAirportPickup({ locationType: "district", placeName: "Antalya" }), false);

  const streetAuto = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "19:09", endDate: "2026-10-08", endTime: "21:09",
    endManual: false, airportPickup: isUetdsAirportPickup(sisli),
  });
  assert.equal(streetAuto.endTime, "21:09");
  const streetManual = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "19:09", endDate: "2026-10-08", endTime: "19:09",
    endManual: true, airportPickup: false,
  });
  assert.equal(streetManual.endTime, "19:39");
  assert.equal(streetManual.raisedToMinimum, true);

  const airportAuto = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "19:13", endDate: "2026-10-08", endTime: "21:12",
    endManual: false, airportPickup: isUetdsAirportPickup(parking),
  });
  assert.equal(airportAuto.endDate, "2026-10-08");
  assert.equal(airportAuto.endTime, "22:13");
  const airportManual = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "19:13", endDate: "2026-10-08", endTime: "19:13",
    endManual: true, airportPickup: true,
  });
  assert.equal(airportManual.endTime, "20:13");
  assert.equal(airportManual.raisedToMinimum, true);

  const dropoffDoesNotExtend = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "22:00",
    endManual: false, airportPickup: isUetdsAirportPickup(sisli),
  });
  assert.equal(isUetdsAirportPickup(airportDropoff), true);
  assert.equal(dropoffDoesNotExtend.endTime, "22:00");

  const shiftedAuto = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "19:15", endDate: "2026-10-08", endTime: "21:09",
    endManual: false, airportPickup: false,
  });
  assert.equal(shiftedAuto.endTime, "21:15");
  const shiftedManual = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:10", endDate: "2026-10-08", endTime: "20:30",
    endManual: true, airportPickup: false,
  });
  assert.equal(shiftedManual.endTime, "20:40");
  assert.equal(shiftedManual.raisedToMinimum, true);
  const keptLong = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "20:10", endDate: "2026-10-08", endTime: "23:30",
    endManual: true, airportPickup: false,
  });
  assert.equal(keptLong.endTime, "23:30");
  assert.equal(keptLong.raisedToMinimum, false);

  const midnightAirport = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "23:00", endDate: "", endTime: "",
    endManual: false, airportPickup: true,
  });
  assert.equal(midnightAirport.endDate, "2026-10-09");
  assert.equal(midnightAirport.endTime, "02:00");
  const midnightStreet = applyUetdsStartToEnd({
    startDate: "2026-10-08", startTime: "23:00", endDate: "", endTime: "",
    endManual: false, airportPickup: false,
  });
  assert.equal(midnightStreet.endDate, "2026-10-09");
  assert.equal(midnightStreet.endTime, "01:00");

  assert.equal(UETDS_DEFAULT_START_LEAD_MS, 65 * 60 * 1000);
  assert.equal(uetdsMinimumStart(istanbulLocalToUtcMs("2026-10-08T18:00")).time, "19:05");
});
