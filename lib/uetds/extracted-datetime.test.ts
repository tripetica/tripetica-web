import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { mapAiUetdsExtraction, mergeAiUetdsExtraction } from "@/lib/uetds/ai-extraction-schema";
import { createEmptyDraft } from "@/lib/uetds/draft";
import {
  parseDescribedTripDates,
  resolveYearlessCivilDateTime,
  UETDS_YEARLESS_WINDOW_MS,
} from "@/lib/uetds/extracted-datetime";
import {
  UETDS_DEFAULT_END_OFFSET_MS,
  UETDS_DEFAULT_START_LEAD_MS,
  UETDS_SUBMIT_MIN_REMAINING_MS,
} from "@/lib/uetds/trip-time";

const SEP30 = istanbulLocalToUtcMs("2026-09-30T12:00");
const empty = {
  origin: null, destination: null, startDate: null, startTime: null, endDate: null, endTime: null,
  tripKind: null, purpose: null, fare: null, flightCode: null,
  passengers: [{ firstName: "Ada", lastName: "Lovelace", nationality: "TR", identityNumber: null, gender: "female" }],
};

function startOf(text: string, now = SEP30) {
  return parseDescribedTripDates(text, now).start;
}

test("yearless clock accepts 8:00 and 08:00 on the same Istanbul day", () => {
  const now = istanbulLocalToUtcMs("2026-09-30T07:00");
  for (const text of ["30 Eylül 8:00", "30 Eylül 08:00"]) {
    const start = startOf(text, now);
    assert.equal(start?.status, "resolved");
    if (start?.status === "resolved") {
      assert.equal(start.date, "2026-09-30");
      assert.equal(start.time, "08:00");
    }
  }
});

test("A/B: 1 Ekim and 01 Ekim 12:00 resolve inside the 30-day window", () => {
  for (const text of ["1 Ekim 12:00", "01 Ekim 12:00"]) {
    const start = startOf(text);
    assert.equal(start?.status, "resolved");
    if (start?.status === "resolved") {
      assert.equal(start.date, "2026-10-01");
      assert.equal(start.time, "12:00");
      assert.equal(start.yearExplicit, false);
    }
  }
});

test("C: 29 Ekim 12:00 is kept when the timestamp is inside 30 days", () => {
  const start = startOf("29 Ekim 12:00");
  assert.equal(start?.status, "resolved");
  if (start?.status === "resolved") {
    assert.equal(start.date, "2026-10-29");
    assert.equal(start.time, "12:00");
  }
});

test("D: past 27 Eylül is not rolled to next year", () => {
  const start = startOf("27 Eylül 12:00");
  assert.equal(start?.status, "rejected");
  const mapped = mapAiUetdsExtraction(
    { ...empty, startDate: "2027-09-27", startTime: "12:00" },
    "27 Eylül 12:00",
    SEP30,
  );
  assert.equal(mapped.startDate, undefined);
  assert.notEqual(mapped.startDate, "2027-09-27");
  const merged = mergeAiUetdsExtraction(
    createEmptyDraft("manual", { applyTripDefaults: false }),
    mapped,
    SEP30,
  ).draft;
  assert.equal(merged.startDate, "2026-09-30");
  assert.equal(merged.startTime, "13:05");
});

test("E: yearless date outside the window falls back to now + 65 minutes", () => {
  const start = startOf("15 Kasım 12:00");
  assert.equal(start?.status, "rejected");
  const mapped = mapAiUetdsExtraction(
    { ...empty, startDate: "2026-11-15", startTime: "12:00" },
    "15 Kasım 12:00",
    SEP30,
  );
  assert.equal(mapped.startDate, undefined);
  const merged = mergeAiUetdsExtraction(
    createEmptyDraft("manual", { applyTripDefaults: false }),
    mapped,
    SEP30,
  ).draft;
  assert.equal(merged.startDate, "2026-09-30");
  assert.equal(merged.startTime, "13:05");
});

test("F: year boundary keeps 5 Ocak in the next year when it is inside 30 days", () => {
  const now = istanbulLocalToUtcMs("2026-12-20T10:00");
  const start = startOf("5 Ocak 12:00", now);
  assert.equal(start?.status, "resolved");
  if (start?.status === "resolved") {
    assert.equal(start.date, "2027-01-05");
    assert.equal(start.time, "12:00");
    assert.equal(start.yearExplicit, false);
  }
});

test("G: an explicit year is kept and is not rewritten by the 30-day window", () => {
  const mapped = mapAiUetdsExtraction(
    { ...empty, startDate: "2026-09-27", startTime: "12:00" },
    "27 Eylül 2027 12:00",
    SEP30,
  );
  assert.equal(mapped.startDate, "2027-09-27");
  assert.equal(mapped.startTime, "12:00");
  const merged = mergeAiUetdsExtraction(
    createEmptyDraft("manual", { applyTripDefaults: false }),
    mapped,
    SEP30,
  ).draft;
  assert.equal(merged.startDate, "2027-09-27");
  assert.equal(merged.startTime, "12:00");
  const later = mapAiUetdsExtraction({ ...empty, startDate: null, startTime: null }, "30 Eylül 2027 08:00", SEP30);
  assert.equal(later.startDate, "2027-09-30");
  assert.equal(later.startTime, "08:00");
});

test("H/I: missing start is still now + 65 minutes and a short end is still start + 3 hours", () => {
  assert.equal(UETDS_DEFAULT_START_LEAD_MS, 65 * 60 * 1000);
  assert.equal(UETDS_DEFAULT_END_OFFSET_MS, 3 * 60 * 60 * 1000);
  assert.equal(UETDS_SUBMIT_MIN_REMAINING_MS, 62 * 60 * 1000);
  const mapped = mapAiUetdsExtraction(
    { ...empty, startDate: "0000-10-01", startTime: "12:00" },
    "",
    SEP30,
  );
  assert.equal(mapped.startDate, "2026-10-01");
  assert.equal(mapped.startTime, "12:00");
  const merged = mergeAiUetdsExtraction(
    createEmptyDraft("manual", { applyTripDefaults: false }),
    mapped,
    SEP30,
  ).draft;
  assert.equal(merged.startDate, "2026-10-01");
  assert.equal(merged.startTime, "12:00");
  assert.equal(merged.endDate, "2026-10-01");
  assert.equal(merged.endTime, "15:00");
});

test("J: the 30-day window is inclusive on the timestamp and exclusive one minute later", () => {
  assert.equal(UETDS_YEARLESS_WINDOW_MS, 30 * 24 * 60 * 60 * 1000);
  const onEdge = resolveYearlessCivilDateTime({
    month: 10,
    day: 30,
    hour: 12,
    minute: 0,
    nowUtcMs: SEP30,
  });
  assert.deepEqual(onEdge, { date: "2026-10-30", time: "12:00" });
  const pastEdge = resolveYearlessCivilDateTime({
    month: 10,
    day: 30,
    hour: 12,
    minute: 1,
    nowUtcMs: SEP30,
  });
  assert.equal(pastEdge, null);
  assert.equal(startOf("30 Ekim 12:00")?.status, "resolved");
  assert.equal(startOf("30 Ekim 12:01")?.status, "rejected");
});

test("shared parser is used by new-notification extraction and does not guess a year in the model prompt", () => {
  const schema = readFileSync(new URL("./ai-extraction-schema.ts", import.meta.url), "utf8");
  const prompt = readFileSync(new URL("./ai-extraction.ts", import.meta.url), "utf8");
  assert.match(schema, /reconcileExtractedTripDates/);
  assert.match(prompt, /0000-MM-DD/);
  assert.match(prompt, /Never guess a year/);
});
