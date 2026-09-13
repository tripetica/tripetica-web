import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { istanbulDayStart } from "@/lib/ops/process-filters";
import { pickupAtBounds } from "@/lib/ops/reservation-filters";
import {
  PARTNER_ACCEPTED_COMPLETED_EXISTS_SQL,
  hasActivePartnerAcceptedJobFilters,
  parsePartnerAcceptedJobFilters,
  partnerAcceptedJobCompletedClause,
  partnerAcceptedJobPickupBounds,
  partnerAcceptedJobQueryRecord,
} from "@/lib/partner/accepted-job-filters";

const NOW = Date.parse("2026-08-27T15:00:00.000Z");

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("partner accepted filters reuse Ops date preset and pickup_at bounds", () => {
  const parsed = parsePartnerAcceptedJobFilters({
    date: "today",
    from: "2026-08-01",
    to: "2026-08-02",
    operation: "",
  });
  assert.equal(parsed.date, "today");
  assert.equal(parsed.from, "");
  assert.equal(parsed.to, "");
  assert.deepEqual(
    partnerAcceptedJobPickupBounds(parsed, NOW),
    pickupAtBounds("today", "", "", NOW),
  );
  assert.deepEqual(partnerAcceptedJobPickupBounds(parsed, NOW), {
    kind: "range",
    start: istanbulDayStart("2026-08-27"),
    end: istanbulDayStart("2026-08-28"),
  });
  assert.deepEqual(
    partnerAcceptedJobPickupBounds(
      { date: "yesterday", from: "", to: "", operation: "" },
      NOW,
    ),
    pickupAtBounds("yesterday", "", "", NOW),
  );
  assert.deepEqual(
    partnerAcceptedJobPickupBounds(
      { date: "tomorrow", from: "", to: "", operation: "" },
      NOW,
    ),
    pickupAtBounds("tomorrow", "", "", NOW),
  );
  assert.deepEqual(
    partnerAcceptedJobPickupBounds({ date: "7d", from: "", to: "", operation: "" }, NOW),
    pickupAtBounds("7d", "", "", NOW),
  );
  assert.deepEqual(
    partnerAcceptedJobPickupBounds({ date: "month", from: "", to: "", operation: "" }, NOW),
    pickupAtBounds("month", "", "", NOW),
  );
  assert.deepEqual(
    partnerAcceptedJobPickupBounds(
      { date: "next_month", from: "", to: "", operation: "" },
      NOW,
    ),
    pickupAtBounds("next_month", "", "", NOW),
  );
  assert.deepEqual(
    partnerAcceptedJobPickupBounds(
      { date: "past_month", from: "", to: "", operation: "" },
      NOW,
    ),
    pickupAtBounds("past_month", "", "", NOW),
  );
  assert.deepEqual(
    partnerAcceptedJobPickupBounds(
      { date: "upcoming", from: "", to: "", operation: "" },
      NOW,
    ),
    pickupAtBounds("upcoming", "", "", NOW),
  );
  assert.deepEqual(
    partnerAcceptedJobPickupBounds({ date: "past", from: "", to: "", operation: "" }, NOW),
    pickupAtBounds("past", "", "", NOW),
  );
  assert.deepEqual(
    partnerAcceptedJobPickupBounds(
      { date: "range", from: "2026-08-25", to: "2026-08-28", operation: "" },
      NOW,
    ),
    pickupAtBounds("range", "2026-08-25", "2026-08-28", NOW),
  );
});

test("partner completed filter uses the same driver-task EXISTS as Ops", () => {
  const ops = source("lib/ops/reservations.ts");
  assert.match(ops, /current_stage = 'completed'/);
  assert.equal(
    partnerAcceptedJobCompletedClause(""),
    `NOT ${PARTNER_ACCEPTED_COMPLETED_EXISTS_SQL}`,
  );
  assert.equal(
    partnerAcceptedJobCompletedClause("completed"),
    PARTNER_ACCEPTED_COMPLETED_EXISTS_SQL,
  );
  assert.match(PARTNER_ACCEPTED_COMPLETED_EXISTS_SQL, /reservation_driver_tasks/);
  assert.match(PARTNER_ACCEPTED_COMPLETED_EXISTS_SQL, /current_stage = 'completed'/);
  const jobs = source("lib/partner/jobs.ts");
  assert.match(jobs, /partnerAcceptedJobCompletedClause/);
  assert.match(jobs, /partnerAcceptedJobPickupBounds/);
  assert.match(jobs, /filters\?: PartnerAcceptedJobFilters/);
  assert.doesNotMatch(jobs, /pickup_at < NOW\(\)/);
});

test("default Partner İşlerim excludes completed and Ops partner list stays unfiltered", () => {
  const accepted = source("app/[locale]/partner/(panel)/accepted/page.tsx");
  assert.match(accepted, /parsePartnerAcceptedJobFilters/);
  assert.match(accepted, /listAcceptedPartnerJobs\(/);
  assert.match(accepted, /filters,/);
  assert.match(accepted, /AcceptedJobFilters/);
  assert.doesNotMatch(source("app/[locale]/partner/(panel)/jobs/page.tsx"), /AcceptedJobFilters/);
  assert.doesNotMatch(source("app/[locale]/partner/(panel)/jobs/page.tsx"), /parsePartnerAcceptedJobFilters/);
  const opsPartner = source("lib/ops/partner-jobs.ts");
  assert.match(opsPartner, /listAcceptedPartnerJobs\(\{/);
  assert.doesNotMatch(opsPartner, /filters/);
  const filtersUi = source("components/partner/accepted-job-filters.tsx");
  assert.match(filtersUi, /RESERVATION_DATE_PRESETS/);
  assert.match(filtersUi, /jobOperationCompleted/);
  assert.match(filtersUi, /\/partner\/accepted/);
  assert.doesNotMatch(filtersUi, /\/ops\/reservations/);
});

test("completed query record toggles independently of date", () => {
  const filters = parsePartnerAcceptedJobFilters({
    date: "today",
    operation: "completed",
  });
  assert.equal(filters.date, "today");
  assert.equal(filters.operation, "completed");
  assert.equal(hasActivePartnerAcceptedJobFilters(filters), true);
  const record = partnerAcceptedJobQueryRecord(filters);
  assert.equal(record.date, "today");
  assert.equal(record.operation, "completed");
  assert.equal(hasActivePartnerAcceptedJobFilters(parsePartnerAcceptedJobFilters({})), false);
});
