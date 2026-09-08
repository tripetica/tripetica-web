import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addCalendarDays,
  createdAtBounds,
  istanbulDayStart,
  parseIsoDate,
  parseProcessDatePreset,
  parseProcessListFilters,
  uniqueUuids,
} from "@/lib/ops/process-filters";

const NOW = Date.parse("2026-08-27T15:00:00.000Z");

test("date presets map from query values", () => {
  assert.equal(parseProcessDatePreset("today"), "today");
  assert.equal(parseProcessDatePreset("past"), "past");
  assert.equal(parseProcessDatePreset("range"), "range");
  assert.equal(parseProcessDatePreset("transfer"), "");
});

test("ISO dates reject invalid calendar days", () => {
  assert.equal(parseIsoDate("2026-08-25"), "2026-08-25");
  assert.equal(parseIsoDate("2026-02-30"), null);
  assert.equal(parseIsoDate("25.08.2026"), null);
});

test("today/yesterday/last 7 days/this month/past use Istanbul created_at bounds", () => {
  const today = createdAtBounds("today", "", "", NOW);
  const yesterday = createdAtBounds("yesterday", "", "", NOW);
  const last7 = createdAtBounds("7d", "", "", NOW);
  const month = createdAtBounds("month", "", "", NOW);
  const past = createdAtBounds("past", "", "", NOW);
  assert.deepEqual(today, {
    kind: "range",
    start: istanbulDayStart("2026-08-27"),
    end: istanbulDayStart("2026-08-28"),
  });
  assert.deepEqual(yesterday, {
    kind: "range",
    start: istanbulDayStart("2026-08-26"),
    end: istanbulDayStart("2026-08-27"),
  });
  assert.deepEqual(last7, {
    kind: "range",
    start: istanbulDayStart("2026-08-21"),
    end: istanbulDayStart("2026-08-28"),
  });
  assert.deepEqual(month, {
    kind: "range",
    start: istanbulDayStart("2026-08-01"),
    end: istanbulDayStart("2026-09-01"),
  });
  assert.deepEqual(past, {
    kind: "before",
    end: istanbulDayStart("2026-08-26"),
  });
});

test("date range includes both start and end days", () => {
  const bounds = createdAtBounds("range", "2026-08-25", "2026-08-28", NOW);
  assert.deepEqual(bounds, {
    kind: "range",
    start: istanbulDayStart("2026-08-25"),
    end: istanbulDayStart("2026-08-29"),
  });
});

test("inverted range is swapped and calendar add stays on the date string", () => {
  const bounds = createdAtBounds("range", "2026-08-28", "2026-08-25", NOW);
  assert.equal(addCalendarDays("2026-08-28", 1), "2026-08-29");
  assert.deepEqual(bounds, createdAtBounds("range", "2026-08-25", "2026-08-28", NOW));
});

test("combined filters keep search/status/locale/conversion with date", () => {
  const filters = parseProcessListFilters({
    q: "  ada@ ",
    status: "draft",
    locale: "ru",
    conversion: "open",
    date: "today",
    from: "2026-08-01",
    to: "2026-08-31",
  });
  assert.equal(filters.query, "ada@");
  assert.equal(filters.status, "draft");
  assert.equal(filters.locale, "ru");
  assert.equal(filters.conversion, "open");
  assert.equal(filters.date, "today");
  assert.equal(filters.from, "");
  assert.equal(filters.to, "");
});

test("uuid list is parameterized-safe and de-duplicated", () => {
  const ids = uniqueUuids([
    "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "3FA85F64-5717-4562-B3FC-2C963F66AFA6",
    "not-a-uuid",
    "11111111-1111-4111-8111-111111111111",
  ]);
  assert.deepEqual(ids, [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "11111111-1111-4111-8111-111111111111",
  ]);
});

test("process filter UI drops the language select but keeps query locale semantics", () => {
  const filters = readFileSync(
    new URL("../../components/ops/process-filters.tsx", import.meta.url),
    "utf8",
  );
  assert.match(filters, /OpsRefreshButton/);
  assert.match(filters, /ops-process-filters/);
  assert.match(filters, /name="status"/);
  assert.match(filters, /name="conversion"/);
  assert.doesNotMatch(filters, /name="locale"/);
  assert.match(
    readFileSync(new URL("../../lib/ops/process-filters.ts", import.meta.url), "utf8"),
    /parseProcessLocaleFilter/,
  );
  assert.match(
    readFileSync(new URL("../../components/ops/language-switcher.tsx", import.meta.url), "utf8"),
    /localeCatalog/,
  );
});
