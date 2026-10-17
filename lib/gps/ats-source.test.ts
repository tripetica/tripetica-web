import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ATS_PERIOD_MS, atsPeriodSlot } from "@/lib/gps/ats-window";
import { ministryAtsFeed, planAtsSourceSave } from "@/lib/gps/ats-source";
import { selectAtsFeed } from "@/lib/gps/ats-feed";

const start = Date.parse("2026-10-13T13:10:00.000Z");
const end = Date.parse("2026-10-13T15:10:00.000Z");
const open = {
  source: "mobile" as const,
  gpsAtsEnabled: true,
  mobileEnabled: true,
  subscriptionOpen: true,
  measuredAt: "2026-10-13T13:08:00.000Z",
  nowMs: start + 4 * 60 * 1000,
  tripStartMs: start,
  tripEndMs: end,
  vehicleMatches: true,
  driverMatches: true,
  companyMatches: true,
};

test("one subscription allows only its own ministry source", () => {
  assert.equal(ministryAtsFeed({ source: "physical", gpsAtsEnabled: true, mobileEnabled: false }), "physical");
  assert.equal(ministryAtsFeed({ source: "mobile", gpsAtsEnabled: true, mobileEnabled: false }), "none");
  assert.equal(ministryAtsFeed({ source: "mobile", gpsAtsEnabled: false, mobileEnabled: true }), "mobile");
  assert.equal(ministryAtsFeed({ source: "physical", gpsAtsEnabled: false, mobileEnabled: true }), "none");
});

test("both subscriptions stay independent and only the selected source is sent", () => {
  const both = { gpsAtsEnabled: true, mobileEnabled: true };
  assert.equal(ministryAtsFeed({ ...both, source: "mobile" }), "mobile");
  assert.equal(ministryAtsFeed({ ...both, source: "physical" }), "physical");
  assert.equal(selectAtsFeed({ ...open, ...both, source: "mobile" }), "mobile");
  assert.equal(selectAtsFeed({ ...open, ...both, source: "physical" }), "physical");
});

test("neither subscription and an unselected source send nothing", () => {
  assert.equal(ministryAtsFeed({ source: "none", gpsAtsEnabled: false, mobileEnabled: false }), "none");
  assert.equal(ministryAtsFeed({ source: "none", gpsAtsEnabled: true, mobileEnabled: true }), "none");
  assert.equal(selectAtsFeed({ ...open, source: "none", nowMs: start - 60_000 }), "none");
  assert.equal(selectAtsFeed({ ...open, source: "mobile", nowMs: end + 60_000 }), "none");
});

test("a passive source cannot be selected and an API-invalid plan is rejected", () => {
  assert.equal(planAtsSourceSave({
    currentSource: "none",
    nextSource: "mobile",
    gpsAtsEnabled: true,
    mobileEnabled: false,
    confirm: "",
  }).ok, false);
  assert.equal(planAtsSourceSave({
    currentSource: "none",
    nextSource: "physical",
    gpsAtsEnabled: false,
    mobileEnabled: true,
    confirm: "",
  }).ok, false);
});

test("closing the active source requires a switch or an explicit stop", () => {
  const closing = {
    currentSource: "physical" as const,
    nextSource: "physical" as const,
    gpsAtsEnabled: false,
    mobileEnabled: true,
    confirm: "",
  };
  assert.equal(planAtsSourceSave(closing).ok, false);
  assert.deepEqual(planAtsSourceSave({ ...closing, confirm: "switch", nextSource: "mobile" }), { ok: true, source: "mobile" });
  assert.deepEqual(planAtsSourceSave({ ...closing, confirm: "stop", nextSource: "none" }), { ok: true, source: "none" });
  assert.equal(planAtsSourceSave({ ...closing, mobileEnabled: false, confirm: "switch", nextSource: "mobile" }).ok, false);
});

test("a source change keeps the two-minute slot and does not open a second send", () => {
  const first = atsPeriodSlot(start);
  const changed = atsPeriodSlot(start + 60_000);
  const next = atsPeriodSlot(start + ATS_PERIOD_MS);
  assert.equal(ATS_PERIOD_MS, 120_000);
  assert.equal(changed, first);
  assert.equal(next, first + 1);
  const physical = readFileSync(new URL("./ats-run.ts", import.meta.url), "utf8");
  const mobile = readFileSync(new URL("./ats-mobile-dispatch.ts", import.meta.url), "utf8");
  const reminders = readFileSync(new URL("./mobile-reminder-run.ts", import.meta.url), "utf8");
  assert.match(physical, /ats_ministry_source = 'physical'/);
  assert.match(physical, /withAtsSlot/);
  assert.match(mobile, /ats_ministry_source !== "mobile"/);
  assert.match(mobile, /withAtsSlot/);
  assert.doesNotMatch(mobile, /physical_live/);
  assert.match(reminders, /ats_ministry_source = 'mobile'/);
  assert.match(reminders, /service_mobile_gps_enabled/);
  const migration = readFileSync(new URL("../../db/migrations/100_ats_ministry_source.sql", import.meta.url), "utf8");
  assert.match(migration, /SET ats_ministry_source = 'physical'/);
  assert.match(migration, /SET ats_ministry_source = 'mobile'/);
  assert.match(migration, /SET ats_ministry_source = 'none'/);
  assert.match(migration, /WHERE vehicle.ats_ministry_source IS NULL/);
  assert.doesNotMatch(migration, /34egp847/);
});
