import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  istanbulDayStart,
  parseIsoDate,
} from "@/lib/ops/process-filters";
import {
  hasActiveReservationFilters,
  nextReservationSortDir,
  parseReservationDatePreset,
  parseReservationListFilters,
  pickupAtBounds,
  reservationOrderBy,
  reservationQueryRecord,
} from "@/lib/ops/reservation-filters";

const NOW = Date.parse("2026-08-27T15:00:00.000Z");

test("reservation date presets parse from query values", () => {
  assert.equal(parseReservationDatePreset("today"), "today");
  assert.equal(parseReservationDatePreset("yesterday"), "yesterday");
  assert.equal(parseReservationDatePreset("tomorrow"), "tomorrow");
  assert.equal(parseReservationDatePreset("upcoming"), "upcoming");
  assert.equal(parseReservationDatePreset("draft"), "");
});

test("today and tomorrow use Istanbul pickup_at day bounds", () => {
  const today = pickupAtBounds("today", "", "", NOW);
  const tomorrow = pickupAtBounds("tomorrow", "", "", NOW);
  assert.deepEqual(today, {
    kind: "range",
    start: istanbulDayStart("2026-08-27"),
    end: istanbulDayStart("2026-08-28"),
  });
  assert.deepEqual(tomorrow, {
    kind: "range",
    start: istanbulDayStart("2026-08-28"),
    end: istanbulDayStart("2026-08-29"),
  });
});

test("yesterday uses the previous Istanbul calendar day", () => {
  const yesterday = pickupAtBounds("yesterday", "", "", NOW);
  assert.deepEqual(yesterday, {
    kind: "range",
    start: istanbulDayStart("2026-08-26"),
    end: istanbulDayStart("2026-08-27"),
  });
});

test("yesterday around Istanbul midnight stays on the prior calendar day", () => {
  // 2026-08-27 00:30 Istanbul = 2026-08-26 21:30 UTC
  const justAfterMidnight = Date.parse("2026-08-26T21:30:00.000Z");
  const yesterday = pickupAtBounds("yesterday", "", "", justAfterMidnight);
  assert.deepEqual(yesterday, {
    kind: "range",
    start: istanbulDayStart("2026-08-26"),
    end: istanbulDayStart("2026-08-27"),
  });
});

test("upcoming and past use the 6 hour operation tolerance", () => {
  const upcoming = pickupAtBounds("upcoming", "", "", NOW);
  const past = pickupAtBounds("past", "", "", NOW);
  assert.equal(upcoming?.kind, "after");
  assert.equal(past?.kind, "before");
  if (upcoming?.kind === "after" && past?.kind === "before") {
    assert.equal(upcoming.start.getTime(), NOW - 6 * 60 * 60 * 1000);
    assert.equal(past.end.getTime(), NOW - 6 * 60 * 60 * 1000);
  }
});

test("next 7 days starts at operation cutoff and ends after the seventh day", () => {
  const bounds = pickupAtBounds("7d", "", "", NOW);
  assert.equal(bounds?.kind, "range");
  if (bounds?.kind === "range") {
    assert.equal(bounds.start.getTime(), NOW - 6 * 60 * 60 * 1000);
    assert.deepEqual(bounds.end, istanbulDayStart("2026-09-03"));
  }
});

test("month presets use calendar month boundaries in Istanbul", () => {
  const month = pickupAtBounds("month", "", "", NOW);
  const nextMonth = pickupAtBounds("next_month", "", "", NOW);
  const pastMonth = pickupAtBounds("past_month", "", "", NOW);
  assert.deepEqual(month, {
    kind: "range",
    start: istanbulDayStart("2026-08-01"),
    end: istanbulDayStart("2026-09-01"),
  });
  assert.deepEqual(nextMonth, {
    kind: "range",
    start: istanbulDayStart("2026-09-01"),
    end: istanbulDayStart("2026-10-01"),
  });
  assert.deepEqual(pastMonth, {
    kind: "range",
    start: istanbulDayStart("2026-07-01"),
    end: istanbulDayStart("2026-08-01"),
  });
});

test("range includes both start and end days", () => {
  const bounds = pickupAtBounds("range", "2026-08-25", "2026-08-28", NOW);
  assert.deepEqual(bounds, {
    kind: "range",
    start: istanbulDayStart("2026-08-25"),
    end: istanbulDayStart("2026-08-29"),
  });
});

test("combined reservation filters keep search, status, payment, and date", () => {
  const filters = parseReservationListFilters({
    q: " TRP-1 ",
    status: "confirmed",
    payment: "cash",
    date: "range",
    from: "2026-08-25",
    to: "2026-08-28",
  });
  assert.equal(filters.query, "TRP-1");
  assert.equal(filters.status, "confirmed");
  assert.equal(filters.payment, "cash");
  assert.equal(filters.date, "range");
  assert.equal(filters.from, "2026-08-25");
  assert.equal(parseIsoDate(filters.to), "2026-08-28");
  assert.equal(filters.sort, "");
  assert.equal(filters.dir, "");
  assert.equal(filters.operation, "");
});

test("completed operation filter is independent of date search", () => {
  const filters = parseReservationListFilters({
    q: "TRP",
    date: "today",
    operation: "completed",
  });
  assert.equal(filters.query, "TRP");
  assert.equal(filters.date, "today");
  assert.equal(filters.operation, "completed");
  assert.equal(hasActiveReservationFilters(filters), true);
  const record = reservationQueryRecord(filters);
  assert.equal(record.operation, "completed");
  assert.equal(record.date, "today");
});

test("sort params parse and default dir to asc when sort is set", () => {
  assert.deepEqual(
    parseReservationListFilters({ sort: "pickup_at", dir: "desc" }).sort,
    "pickup_at",
  );
  assert.equal(parseReservationListFilters({ sort: "pickup_at", dir: "desc" }).dir, "desc");
  assert.equal(parseReservationListFilters({ sort: "created_at" }).dir, "asc");
  assert.equal(parseReservationListFilters({ sort: "nope" }).sort, "");
});

test("next sort dir starts at asc then toggles", () => {
  assert.equal(nextReservationSortDir("", "", "pickup_at"), "asc");
  assert.equal(nextReservationSortDir("pickup_at", "asc", "pickup_at"), "desc");
  assert.equal(nextReservationSortDir("pickup_at", "desc", "pickup_at"), "asc");
  assert.equal(nextReservationSortDir("created_at", "desc", "pickup_at"), "asc");
});

test("order by keeps default created_at desc without explicit sort", () => {
  assert.equal(
    reservationOrderBy({
      query: "",
      status: "",
      payment: "",
      date: "",
      from: "",
      to: "",
      sort: "",
      dir: "",
    }),
    "created_at DESC, id DESC",
  );
  assert.equal(
    reservationOrderBy({
      query: "",
      status: "",
      payment: "",
      date: "upcoming",
      from: "",
      to: "",
      sort: "",
      dir: "",
    }),
    "pickup_at ASC NULLS LAST, created_at ASC, id ASC",
  );
  assert.equal(
    reservationOrderBy({
      query: "",
      status: "",
      payment: "",
      date: "upcoming",
      from: "",
      to: "",
      sort: "created_at",
      dir: "desc",
    }),
    "created_at DESC, id DESC",
  );
  assert.equal(
    reservationOrderBy({
      query: "",
      status: "",
      payment: "",
      date: "",
      from: "",
      to: "",
      sort: "pickup_at",
      dir: "asc",
    }),
    "pickup_at ASC NULLS LAST, created_at ASC, id ASC",
  );
  assert.equal(
    reservationOrderBy({
      query: "",
      status: "",
      payment: "",
      date: "",
      from: "",
      to: "",
      sort: "pickup_at",
      dir: "desc",
    }),
    "pickup_at DESC NULLS LAST, created_at DESC, id DESC",
  );
  assert.equal(
    reservationOrderBy({
      query: "",
      status: "",
      payment: "",
      date: "",
      from: "",
      to: "",
      sort: "created_at",
      dir: "asc",
    }),
    "created_at ASC, id ASC",
  );
  assert.equal(
    reservationOrderBy(
      {
        query: "",
        status: "",
        payment: "",
        date: "",
        from: "",
        to: "",
        sort: "pickup_at",
        dir: "asc",
      },
      "jobs",
    ),
    "jobs.pickup_at ASC NULLS LAST, jobs.created_at ASC, jobs.id ASC",
  );
  assert.doesNotMatch(reservationOrderBy({
    query: "",
    status: "",
    payment: "",
    date: "",
    from: "",
    to: "",
    sort: "pickup_at",
    dir: "asc",
  }), /updated_at|assignment_updated_at/);
});

test("reservation list applies the same deterministic order after partner joins", () => {
  const list = readFileSync(
    new URL("../../lib/ops/reservations.ts", import.meta.url),
    "utf8",
  );
  assert.match(list, /reservationOrderBy\(input\.filters\)/);
  assert.match(list, /reservationOrderBy\(input\.filters, "jobs"\)/);
  assert.match(list, /ORDER BY \$\{outerOrderBy\}/);
  assert.doesNotMatch(list, /ORDER BY[^\n]*updated_at/);
  assert.doesNotMatch(list, /ORDER BY[^\n]*assignment_updated_at/);
});

test("reservation filters keep search, filter and refresh on one toolbar", () => {
  const filters = readFileSync(
    new URL("../../components/ops/reservation-filters.tsx", import.meta.url),
    "utf8",
  );
  assert.match(filters, /OpsRefreshButton/);
  assert.match(filters, /ops-reservation-search[\s\S]*copy\.filter[\s\S]*OpsRefreshButton/);
  assert.match(
    readFileSync(new URL("../../components/ops/refresh-button.tsx", import.meta.url), "utf8"),
    /router\.refresh\(\)/,
  );
  assert.doesNotMatch(
    readFileSync(new URL("../../components/ops/language-switcher.tsx", import.meta.url), "utf8"),
    /OpsRefreshButton/,
  );
});
