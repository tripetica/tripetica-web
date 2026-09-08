import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partnerCopy } from "@/lib/partner/copy";
import { partnerDriverDetailMode } from "@/lib/partner/driver-detail-view";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("driver detail mode keeps view, edit, and dirty states separate", () => {
  assert.equal(partnerDriverDetailMode(false, false), "view");
  assert.equal(partnerDriverDetailMode(true, false), "edit");
  assert.equal(partnerDriverDetailMode(false, true), "edit-dirty");
  assert.equal(partnerDriverDetailMode(true, true), "edit-dirty");
});

test("driver detail close and cancel use distinct actions", () => {
  const detail = source("components/partner/driver-detail.tsx");
  assert.match(detail, /partnerDriverDetailMode/);
  assert.match(detail, /copy\.closeDriver/);
  assert.match(detail, /copy\.cancelEdit/);
  assert.match(detail, /discardEdits/);
  assert.match(detail, /mode === "edit-dirty"/);
  assert.match(detail, /mode !== "view"/);
  assert.match(detail, /href=\{listHref\}/);
  assert.doesNotMatch(detail, /<a className="ops-btn-secondary" href=\{localizedPath\(locale, "\/partner\/drivers"\)\}>\s*\{copy\.cancelEdit\}/);
  assert.equal(partnerCopy.tr.closeDriver, "Kapat");
  assert.equal(partnerCopy.en.closeDriver, "Close");
  assert.equal(partnerCopy.ru.closeDriver, "Закрыть");
  assert.doesNotMatch(partnerCopy.tr.closeDriver, /Geri/);
  assert.doesNotMatch(partnerCopy.en.closeDriver, /Back/);
});
