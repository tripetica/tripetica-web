import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { atsReportHref, atsReportIsOpen } from "@/lib/gps/ats-history-page";

const path = "/tr/partner/uetds/notifications/trip";

test("ATS pages stay open across next, previous, refresh, and back", () => {
  assert.equal(atsReportIsOpen({}), false);
  assert.equal(atsReportIsOpen({ ats: "1" }), true);
  assert.equal(atsReportIsOpen({ atsPage: "2" }), true);
  assert.equal(atsReportIsOpen({ atsPage: "1" }), false);
  const next = atsReportHref(path, { page: 2, open: true });
  assert.equal(next, `${path}?ats=1&atsPage=2`);
  const previous = atsReportHref(path, { page: 1, editMethod: "1", open: true });
  assert.equal(previous, `${path}?editMethod=1&ats=1`);
  assert.equal(previous.includes("atsPage"), false);
  const closed = atsReportHref(path, { page: 1, editMethod: "1", open: false });
  assert.equal(closed, `${path}?editMethod=1`);
  assert.equal(atsReportIsOpen({ ats: "1", atsPage: "2" }), true);
});

test("the ATS table opens from the URL and page links do not reset it", () => {
  const detail = readFileSync(new URL("../../components/uetds/uetds-notification-detail.tsx", import.meta.url), "utf8");
  assert.match(detail, /useState\(atsVisible\)/);
  assert.match(detail, /setAtsOpen\(atsVisible\)/);
  assert.match(detail, /scroll=\{false\}/);
  assert.doesNotMatch(detail, /useState\(false\)[\s\S]{0,80}atsOpen/);
  assert.doesNotMatch(detail, /google\.com\/maps/);
  assert.match(detail, /\{row\.coordinates \?\? copy\.atsHistoryUnknown\}/);
  const partner = readFileSync(new URL("../../app/[locale]/partner/(panel)/uetds/notifications/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(partner, /atsReportHref/);
  assert.match(partner, /open: true/);
  assert.match(partner, /atsVisible=\{atsReportIsOpen/);
});
