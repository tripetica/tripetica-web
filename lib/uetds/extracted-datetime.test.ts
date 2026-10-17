import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { mergeAiExtractedSources } from "@/lib/uetds/ai-passenger-sources";
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

test("H/I: missing start is still now + 65 minutes and a missing end is start + 2 hours", () => {
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
  assert.equal(merged.endTime, "14:00");
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
  assert.match(prompt, /single unlabeled clock/);
});

const OCT8_1800 = istanbulLocalToUtcMs("2026-10-08T18:00");

function mergedStart(description: string, now = OCT8_1800) {
  const mapped = mapAiUetdsExtraction(
    { ...empty, startDate: null, startTime: null, endDate: null, endTime: null },
    description,
    now,
  );
  return mergeAiUetdsExtraction(
    createEmptyDraft("manual", { applyTripDefaults: false }),
    mapped,
    now,
  ).draft;
}

test("A/B: one clear clock is today's start and is not ignored", () => {
  for (const text of [
    "20:00",
    "Alış 20:00",
    "Saat 20:00",
    "Başlangıç saati 20:00",
    "Başlangıç zamanı 20:00",
    "Sefer başlangıç saati 20:00",
    "Alış saati 20:00",
    "Transfer saati 20:00",
    "Rezervasyon saati 20:00",
    "Saat: 20.00",
    "20.00'de transfer",
  ]) {
    const start = startOf(text, OCT8_1800);
    assert.equal(start?.status, "resolved", text);
    if (start?.status === "resolved") {
      assert.equal(start.date, "2026-10-08", text);
      assert.equal(start.time, "20:00", text);
    }
    const draft = mergedStart(text);
    assert.equal(draft.startDate, "2026-10-08", text);
    assert.equal(draft.startTime, "20:00", text);
    assert.equal(draft.endManual, false, text);
    assert.equal(draft.endTime, "22:00", text);
  }
  const transfer = mergedStart("Transfer saati 20:30");
  assert.equal(transfer.startTime, "20:30");
  assert.equal(transfer.endTime, "22:30");
});

test("a clock earlier than now + 65 minutes becomes now + 65; a later clock is kept", () => {
  for (const text of [
    "20:00",
    "Transfer saati 20:00",
    "Alış saati 20:00",
    "Rezervasyon saati 20:00",
    "Sefer başlangıç saati 20:00",
    "Başlangıç zamanı 20:00",
  ]) {
    const kept = mergedStart(text, OCT8_1800);
    assert.equal(kept.startDate, "2026-10-08", text);
    assert.equal(kept.startTime, "20:00", text);
  }
  for (const text of ["Alış saati 18:30", "Başlangıç zamanı 17:00", "Sefer başlangıç saati 15:00"]) {
    const raised = mergedStart(text, OCT8_1800);
    assert.equal(raised.startDate, "2026-10-08", text);
    assert.equal(raised.startTime, "19:05", text);
  }
});

test("C: a dateless clock outside the next 12 hours uses now + 65 and is not rolled to tomorrow", () => {
  const start = startOf("Saat 15:00", OCT8_1800);
  assert.equal(start?.status, "rejected");
  const draft = mergedStart("Saat 15:00");
  assert.equal(draft.startDate, "2026-10-08");
  assert.equal(draft.startTime, "19:05");
  assert.notEqual(draft.startDate, "2026-10-09");
});

test("D/G: Yarın and 9 Ekim keep the future date", () => {
  const tomorrow = mergedStart("Yarın saat 15:00");
  assert.equal(tomorrow.startDate, "2026-10-09");
  assert.equal(tomorrow.startTime, "15:00");
  const october = mergedStart("9 Ekim saat 15:00");
  assert.equal(october.startDate, "2026-10-09");
  assert.equal(october.startTime, "15:00");
});

test("an explicit end is kept and a lone end clock is not treated as the start", () => {
  const both = parseDescribedTripDates("Başlangıç saati 20:00 Bitiş saati 23:30", OCT8_1800);
  assert.equal(both.start?.status, "resolved");
  assert.equal(both.end?.status, "resolved");
  if (both.start?.status === "resolved" && both.end?.status === "resolved") {
    assert.equal(both.start.time, "20:00");
    assert.equal(both.end.time, "23:30");
  }
  const endOnly = parseDescribedTripDates("Varış 20:00", OCT8_1800);
  assert.equal(endOnly.start, null);
  assert.equal(endOnly.end?.status, "resolved");
  const draft = mergedStart("Başlangıç saati 20:00 Bitiş saati 23:30");
  assert.equal(draft.startTime, "20:00");
  assert.equal(draft.endTime, "23:30");
  assert.equal(draft.endManual, true);
});

test("conflicting unlabeled clocks are not chosen at random", () => {
  const parsed = parseDescribedTripDates("20:00 ve 22:00", OCT8_1800);
  assert.equal(parsed.start?.status, "rejected");
  const mapped = mapAiUetdsExtraction(
    { ...empty, startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "22:00" },
    "20:00 ve 22:00",
    OCT8_1800,
  );
  assert.equal(mapped.startTime, undefined);
  const draft = mergedStart("20:00 ve 22:00");
  assert.equal(draft.startTime, "19:05");
});

test("description clock overrides a different clock in an image or file", () => {
  const now = istanbulLocalToUtcMs("2026-10-08T15:00");
  const description = "Transfer saati 17:30";
  const fileClock = {
    ...empty,
    startDate: "2026-10-08",
    startTime: "16:00",
    endDate: "2026-10-08",
    endTime: "18:00",
  };
  const fromDescription = mapAiUetdsExtraction({ ...empty }, description, now);
  const fromFile = mapAiUetdsExtraction(fileClock, description, now);
  for (const order of [
    [fromDescription, fromFile],
    [fromFile, fromDescription],
  ]) {
    const combined = mergeAiExtractedSources(order);
    assert.equal(combined.startTime, "17:30");
    assert.notEqual(combined.startTime, "16:00");
    const draft = mergeAiUetdsExtraction(
      createEmptyDraft("manual", { applyTripDefaults: false }),
      combined,
      now,
    ).draft;
    assert.equal(draft.startDate, "2026-10-08");
    assert.equal(draft.startTime, "17:30");
  }
  const bare = mapAiUetdsExtraction(fileClock, "17:30", now);
  assert.equal(bare.startTime, "17:30");
  assert.notEqual(bare.startTime, "16:00");
});

test("a model end is ignored when the text only states a start clock", () => {
  const mapped = mapAiUetdsExtraction(
    { ...empty, startDate: "2026-10-08", startTime: "20:00", endDate: "2026-10-08", endTime: "21:12" },
    "Saat 20:00",
    OCT8_1800,
  );
  assert.equal(mapped.startTime, "20:00");
  assert.equal(mapped.endTime, undefined);
  const draft = mergedStart("Saat 20:00");
  assert.equal(draft.endManual, false);
  assert.equal(draft.endTime, "22:00");
});

test("9 Ekim 15:00 at an airport stays the start and the end is three hours later", () => {
  const now = istanbulLocalToUtcMs("2026-10-08T19:30");
  const text = "Alış yeri İstanbul havalimanı\nBırakma yeri Şişli\n9 Ekim 15:00";
  const mapped = mapAiUetdsExtraction(
    { ...empty, startDate: null, startTime: null, endDate: "2026-10-08", endTime: "20:26" },
    text,
    now,
  );
  const draft = mergeAiUetdsExtraction(createEmptyDraft("manual", { nowUtcMs: now }), mapped, now).draft;
  assert.equal(draft.startDate, "2026-10-09");
  assert.equal(draft.startTime, "15:00");
  assert.notEqual(draft.startTime, "20:26");
  assert.equal(draft.endDate, "2026-10-09");
  assert.equal(draft.endTime, "18:00");
  assert.equal(draft.endManual, false);

  const dropoff = mapAiUetdsExtraction(
    { ...empty, startDate: "2026-10-09", startTime: "15:00", endDate: null, endTime: null },
    "Bırakma saati 18:00",
    now,
  );
  assert.equal(dropoff.startDate, "2026-10-09");
  assert.equal(dropoff.startTime, "15:00");
  assert.equal(dropoff.endDate, "2026-10-09");
  assert.equal(dropoff.endTime, "18:00");
});

test("Saati 23:00 after bırakma yeri is the start, not the automatic +65 clock", () => {
  const now = istanbulLocalToUtcMs("2026-10-08T19:21");
  const text = [
    "Ayşe Yılmaz",
    "Kerem Yılmaz",
    "Bekir Yılmaz",
    "Ali Yılmaz",
    "",
    "Alış yeri İstanbul havalimanı",
    "Bırakma yeri Şişli",
    "",
    "Saati 23:00",
    "",
    "Grup ücreti 300",
  ].join("\n");
  const parsed = parseDescribedTripDates(text, now);
  assert.equal(parsed.start?.status, "resolved");
  assert.equal(parsed.end, null);
  if (parsed.start?.status === "resolved") {
    assert.equal(parsed.start.time, "23:00");
  }
  const current = createEmptyDraft("manual", { nowUtcMs: now });
  assert.equal(current.startTime, "20:26");
  const mapped = mapAiUetdsExtraction(
    { ...empty, startDate: "2026-10-08", startTime: "19:09", endDate: null, endTime: null },
    text,
    now,
  );
  assert.equal(mapped.startTime, "23:00");
  assert.equal(mapped.endTime, undefined);
  const draft = mergeAiUetdsExtraction(current, mapped, now).draft;
  assert.equal(draft.startDate, "2026-10-08");
  assert.equal(draft.startTime, "23:00");
  assert.notEqual(draft.startTime, "20:26");
  assert.equal(draft.endManual, false);
  assert.equal(draft.endTime, "02:00");
  assert.equal(draft.endDate, "2026-10-09");
});

test("a bare clock replaces the form's automatic start and recomputes the automatic end", () => {
  const now = istanbulLocalToUtcMs("2026-10-08T19:02");
  const current = createEmptyDraft("manual", { nowUtcMs: now });
  assert.equal(current.startTime, "20:07");
  assert.equal(current.endTime, "22:07");
  current.fieldProvenance.startDate = "user";
  current.fieldProvenance.startTime = "user";
  const mapped = mapAiUetdsExtraction(
    { ...empty, startDate: null, startTime: null, endDate: null, endTime: null },
    "21:00",
    now,
  );
  const merged = mergeAiUetdsExtraction(current, mapped, now);
  assert.equal(merged.conflicts.length, 0);
  assert.equal(merged.draft.startDate, "2026-10-08");
  assert.equal(merged.draft.startTime, "21:00");
  assert.equal(merged.draft.endDate, "2026-10-08");
  assert.equal(merged.draft.endTime, "23:00");
  assert.equal(merged.draft.endManual, false);

  const manualEnd = createEmptyDraft("manual", { nowUtcMs: now });
  manualEnd.endManual = true;
  manualEnd.endTime = "23:40";
  const kept = mergeAiUetdsExtraction(manualEnd, mapped, now).draft;
  assert.equal(kept.startTime, "21:00");
  assert.equal(kept.endTime, "23:40");
  assert.equal(kept.endManual, true);
});

const OCT8_1954 = istanbulLocalToUtcMs("2026-10-08T19:54");

test("a dateless 1:35 at 19:54 is the next occurrence inside 12 hours, and it stays the start", () => {
  const start = startOf("1:35", OCT8_1954);
  assert.equal(start?.status, "resolved");
  if (start?.status === "resolved") {
    assert.equal(start.date, "2026-10-09");
    assert.equal(start.time, "01:35");
  }
  const draft = mergedStart("1:35", OCT8_1954);
  assert.equal(draft.startDate, "2026-10-09");
  assert.equal(draft.startTime, "01:35");
  assert.equal(draft.endManual, false);
  assert.equal(draft.endDate, "2026-10-09");
  assert.equal(draft.endTime, "03:35");
  const tooSoon = mergedStart("20:00", OCT8_1954);
  assert.equal(tooSoon.startDate, "2026-10-08");
  assert.equal(tooSoon.startTime, "20:59");
});

test("an image clock with no date is the start, including a clock the model put on the end", () => {
  const now = OCT8_1954;
  const imageStart = mapAiUetdsExtraction(
    {
      ...empty,
      origin: "İstanbul Havalimanı",
      destination: "Şişli",
      startDate: null,
      startTime: "23:00",
      endDate: null,
      endTime: null,
    },
    "",
    now,
  );
  const fromStart = mergeAiUetdsExtraction(createEmptyDraft("manual", { nowUtcMs: now }), imageStart, now).draft;
  assert.equal(fromStart.startDate, "2026-10-08");
  assert.equal(fromStart.startTime, "23:00");
  assert.notEqual(fromStart.startTime, "20:59");
  assert.equal(fromStart.endManual, false);
  assert.equal(fromStart.endDate, "2026-10-09");
  assert.equal(fromStart.endTime, "02:00");

  const imageEnd = mapAiUetdsExtraction(
    {
      ...empty,
      origin: "İstanbul Havalimanı",
      destination: "Şişli",
      startDate: null,
      startTime: null,
      endDate: null,
      endTime: "23:00",
    },
    "",
    now,
  );
  const fromEnd = mergeAiUetdsExtraction(createEmptyDraft("manual", { nowUtcMs: now }), imageEnd, now).draft;
  assert.equal(fromEnd.startDate, "2026-10-08");
  assert.equal(fromEnd.startTime, "23:00");
  assert.equal(fromEnd.endManual, false);
  assert.equal(fromEnd.endTime, "02:00");

  const bare = mergedStart("23:00", now);
  assert.equal(bare.startDate, "2026-10-08");
  assert.equal(bare.startTime, "23:00");
});

const HPH002306 = `Booking reference ID: HPH002306
Lead participant: ()Sujin Yang
Vehicle Information: 이코노미 차량 7 인승
Passengers: 2
Type: Airport drop-off
From: null(No:12 Hotel Sultanahmet)
To: Istanbul Airport(IST)
Pick-up date & time:: 2026-10-17 14:30
Special Requirements: WhatsApp: Jin.nnn
TEL +821022107368
KLK`;

const NIGHT = istanbulLocalToUtcMs("2026-10-17T00:52");

test("HPH002306 keeps the written pickup and does not become now + 65 minutes", () => {
  const parsed = parseDescribedTripDates(HPH002306, NIGHT);
  assert.equal(parsed.start?.status, "resolved");
  if (parsed.start?.status === "resolved") {
    assert.equal(parsed.start.date, "2026-10-17");
    assert.equal(parsed.start.time, "14:30");
    assert.equal(parsed.start.yearExplicit, true);
  }
  const draft = mergedStart(HPH002306, NIGHT);
  assert.equal(draft.startDate, "2026-10-17");
  assert.equal(draft.startTime, "14:30");
  assert.notEqual(draft.startTime, "01:57");
  assert.equal(draft.endDate, "2026-10-17");
  assert.equal(draft.endTime, "16:30");
  const modelGuess = mapAiUetdsExtraction(
    { ...empty, startDate: "2026-10-17", startTime: "01:57", endDate: "2026-10-17", endTime: "03:57" },
    HPH002306,
    NIGHT,
  );
  assert.equal(modelGuess.startDate, "2026-10-17");
  assert.equal(modelGuess.startTime, "14:30");
  assert.notEqual(modelGuess.startTime, "01:57");
});

test("reservation date and time formats keep the pickup clock", () => {
  const now = NIGHT;
  const cases: Array<[string, string, string]> = [
    ["Pick-up date & time: 2026-10-17 14:30", "2026-10-17", "14:30"],
    ["Pick-up date & time:: 2026-10-17 14:30", "2026-10-17", "14:30"],
    ["Pickup: 17/10/2026 14:30", "2026-10-17", "14:30"],
    ["Pick up: 17.10.2026 14:30", "2026-10-17", "14:30"],
    ["Pickup time: 2:30 PM, October 17, 2026", "2026-10-17", "14:30"],
    ["Departure: 17 Oct 2026 at 14:30", "2026-10-17", "14:30"],
    ["Departure date/time: 2026/10/17 14:30", "2026-10-17", "14:30"],
    ["Alış tarihi ve saati: 17.10.2026 14:30", "2026-10-17", "14:30"],
    ["Alınış: 17 Ekim 2026 saat 14:30", "2026-10-17", "14:30"],
    ["Дата подачи: 17.10.2026 14:30", "2026-10-17", "14:30"],
    ["Abholung: 17.10.2026 um 14:30", "2026-10-17", "14:30"],
    ["Recogida: 17/10/2026 a las 14:30", "2026-10-17", "14:30"],
    ["탑승: 2026년 10월 17일 14시 30분", "2026-10-17", "14:30"],
  ];
  for (const [text, date, time] of cases) {
    const draft = mergedStart(text, now);
    assert.equal(draft.startDate, date, text);
    assert.equal(draft.startTime, time, text);
    assert.equal(draft.endTime, "16:30", text);
  }
  const split = mergedStart("Transfer tarihi: 17/10/2026\nTransfer saati: 14:30", now);
  assert.equal(split.startDate, "2026-10-17");
  assert.equal(split.startTime, "14:30");
  const russianSplit = mergedStart("Дата трансфера: 17 октября 2026\nВремя подачи: 14:30", now);
  assert.equal(russianSplit.startDate, "2026-10-17");
  assert.equal(russianSplit.startTime, "14:30");
});

test("pickup wins over booking, flight, and hotel times", () => {
  const text = [
    "Booking created: 2026-10-15 09:00",
    "Flight departure: 2026-10-17 18:00",
    "Hotel check-in: 2026-10-17 15:00",
    "Pickup date & time: 2026-10-17 14:30",
  ].join("\n");
  const draft = mergedStart(text, NIGHT);
  assert.equal(draft.startDate, "2026-10-17");
  assert.equal(draft.startTime, "14:30");
  assert.notEqual(draft.startTime, "18:00");
  assert.notEqual(draft.startTime, "09:00");
});

test("an ambiguous numeric date is not guessed and a Turkish date is day-first", () => {
  const ambiguous = parseDescribedTripDates("Pickup: 03/04/2026 14:30", NIGHT);
  assert.equal(ambiguous.start?.status, "rejected");
  const fallback = mergedStart("Pickup: 03/04/2026 14:30", NIGHT);
  assert.equal(fallback.startDate, "2026-10-17");
  assert.equal(fallback.startTime, "01:57");
  const turkish = parseDescribedTripDates("Alış tarihi: 03/11/2026 14:30", NIGHT);
  assert.equal(turkish.start?.status, "resolved");
  if (turkish.start?.status === "resolved") {
    assert.equal(turkish.start.date, "2026-11-03");
    assert.equal(turkish.start.time, "14:30");
  }
  const turkishDraft = mergedStart("Alış tarihi: 03/11/2026 14:30", NIGHT);
  assert.equal(turkishDraft.startDate, "2026-11-03");
  assert.equal(turkishDraft.startTime, "14:30");
});

test("a written pickup before the 65 minute minimum is still raised", () => {
  const now = istanbulLocalToUtcMs("2026-10-17T14:00");
  const draft = mergedStart("Pick-up date & time: 2026-10-17 14:30", now);
  assert.equal(draft.startDate, "2026-10-17");
  assert.equal(draft.startTime, "15:05");
});

test("a missing pickup still falls back to now + 65 minutes", () => {
  const draft = mergedStart("From: Hotel Sultanahmet\nTo: Istanbul Airport\nPassengers: 2", NIGHT);
  assert.equal(draft.startDate, "2026-10-17");
  assert.equal(draft.startTime, "01:57");
});
