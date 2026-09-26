import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import {
  adjustUetdsTripTimesForSubmit,
  applyManualUetdsTripDefaults,
  applyUetdsAiExtractionTripTimes,
  applyUetdsStartToEnd,
  defaultUetdsEndFromStart,
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
import { resolveOfficialUetdsLocation } from "@/lib/uetds/official-locations";

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

test("C/D: default end is start plus 3 hours including midnight rollover", () => {
  const daytime = defaultUetdsEndFromStart("2026-09-21", "03:00");
  assert.equal(daytime.date, "2026-09-21");
  assert.equal(daytime.time, "06:00");
  const overnight = defaultUetdsEndFromStart("2026-09-21", "23:00");
  assert.equal(overnight.date, "2026-09-22");
  assert.equal(overnight.time, "02:00");
});

test("3: 70 minutes remaining is submitted unchanged when end also meets +3h", () => {
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
  assert.equal(next.endAdjusted, false);
  assert.equal(next.startTime, "11:10");
  assert.equal(next.endTime, "14:10");
});

test("3b: start kept but end shorter than +3h is raised on submit", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:00");
  const next = adjustUetdsTripTimesForSubmit(
    {
      startDate: "2026-09-20",
      startTime: "11:10",
      endDate: "2026-09-20",
      endTime: "13:10",
      endManual: true,
    },
    now,
  );
  assert.equal(next.startAdjusted, false);
  assert.equal(next.startTime, "11:10");
  assert.equal(next.endAdjusted, true);
  assert.equal(next.endTime, "14:10");
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
  assert.equal(next.endTime, "14:06");
});

test("5: automatic start adjustment moves too-short end to final_start + 3 hours", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:04");
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
  assert.equal(next.startTime, "11:06");
  assert.equal(next.endDate, "2026-09-20");
  assert.equal(next.endTime, "14:06");
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

test("submit example: 15:05/18:05 waiting until 14:30 bumps start to 15:32 and end to 18:32", () => {
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
  assert.equal(next.endTime, "18:32");
  assert.equal(next.startAdjusted, true);
  assert.equal(next.endAdjusted, true);
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

test("manual default start is now + 65 minutes and end follows +3 hours", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:00");
  const defaults = applyManualUetdsTripDefaults(now);
  assert.equal(defaults.startDate, "2026-09-20");
  assert.equal(defaults.startTime, "11:05");
  assert.equal(defaults.endDate, "2026-09-20");
  assert.equal(defaults.endTime, "14:05");
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

test("AI/prefill trip times: missing start → now+65; end rules use start+3h floor", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:00");
  assert.equal(UETDS_DEFAULT_START_LEAD_MS, 65 * 60 * 1000);
  assert.equal(UETDS_SUBMIT_MIN_REMAINING_MS, 62 * 60 * 1000);
  assert.equal(UETDS_SUBMIT_ADJUST_LEAD_MS, 62 * 60 * 1000);

  const missingStart = applyUetdsAiExtractionTripTimes(
    { startDate: "", startTime: "", endDate: "", endTime: "" },
    now,
  );
  assert.equal(missingStart.startTime, "11:05");
  assert.equal(missingStart.endTime, "14:05");
  assert.equal(missingStart.startFromFallback, true);

  const keepSourceStart = applyUetdsAiExtractionTripTimes(
    { startDate: "2026-09-20", startTime: "15:05", endDate: "", endTime: "" },
    now,
  );
  assert.equal(keepSourceStart.startTime, "15:05");
  assert.equal(keepSourceStart.endTime, "18:05");
  assert.equal(keepSourceStart.startFromFallback, false);

  const shortEnd = applyUetdsAiExtractionTripTimes(
    { startDate: "2026-09-20", startTime: "15:05", endDate: "2026-09-20", endTime: "17:05" },
    now,
  );
  assert.equal(shortEnd.endTime, "18:05");
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
      const minimumEnd = appliedStart === "07:00" ? "10:00" : "08:05";
      assert.equal(actual.startTime, appliedStart);
      assert.equal(actual.endTime, end >= minimumEnd ? end : minimumEnd);
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
    assert.equal(ai.endTime, "03:35");
    const submit = adjustUetdsTripTimesForSubmit(input, now);
    assert.equal(submit.startDate, nextDate);
    assert.equal(submit.startTime, "00:32");
    assert.equal(submit.endDate, nextDate);
    assert.equal(submit.endTime, "03:32");
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
      const minimumEnd = finalStart === "07:00" ? "10:00" : "09:12";
      assert.equal(actual.startTime, finalStart);
      assert.equal(actual.startAdjusted, start < "06:12");
      assert.equal(actual.endTime, end >= minimumEnd ? end : minimumEnd);
    });
  }
}

test("one-minute form review preserves AI +65 start; fractional minutes round safely", () => {
  const now = istanbulLocalToUtcMs("2026-09-22T05:00");
  const ai = applyUetdsAiExtractionTripTimes({ startDate: "", startTime: "", endDate: "", endTime: "" }, now);
  const result = adjustUetdsTripTimesForSubmit({ ...ai, endManual: false }, now + 60_000);
  assert.equal(result.startTime, "06:05");
  assert.equal(result.endTime, "09:05");
  assert.equal(result.startAdjusted, false);
  const rounded = applyUetdsAiExtractionTripTimes({ startDate: "", startTime: "", endDate: "", endTime: "" }, now + 1_000);
  assert.equal(rounded.startTime, "06:06");
  assert.equal(rounded.endTime, "09:06");
});
