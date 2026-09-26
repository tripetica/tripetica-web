import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateUetdsEligibility, mapUetdsCompanyReadiness } from "@/lib/uetds/eligibility";
import { uetdsEligibilityMessage, uetdsFormCopy } from "@/lib/uetds/copy";
import { isOversizedUetdsFile } from "@/lib/uetds/upload-limits";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const ready = mapUetdsCompanyReadiness({
  id: "11111111-1111-1111-1111-111111111111",
  shortName: "Example Carrier",
  status: "active",
  integrationStatus: "ready",
});

test("eligibility requires assigned registered fleet plus the same usable company", () => {
  assert.equal(
    evaluateUetdsEligibility({
      driverId: null,
      vehicleId: null,
      driverKind: "registered",
      vehicleKind: "registered",
    }).reason,
    "unassigned",
  );
  assert.equal(
    evaluateUetdsEligibility({
      driverId: null,
      vehicleId: "v1",
      driverKind: "registered",
      vehicleKind: "registered",
    }).reason,
    "unassigned-driver",
  );
  assert.equal(
    evaluateUetdsEligibility({
      driverId: "d1",
      vehicleId: null,
      driverKind: "registered",
      vehicleKind: "registered",
    }).reason,
    "unassigned-vehicle",
  );
  assert.equal(
    evaluateUetdsEligibility({
      driverId: "d1",
      vehicleId: "v1",
      driverKind: "non_trp",
      vehicleKind: "registered",
      driverCompanyId: ready?.id,
      vehicleCompanyId: ready?.id,
      company: ready,
    }).reason,
    "unassigned-driver",
  );
  assert.equal(
    evaluateUetdsEligibility({
      driverId: "d1",
      vehicleId: "v1",
      driverKind: "registered",
      vehicleKind: "registered",
    }).reason,
    "external",
  );
  assert.equal(
    evaluateUetdsEligibility({
      driverId: "d1",
      vehicleId: "v1",
      driverKind: "registered",
      vehicleKind: "registered",
      driverCompanyId: ready?.id,
    }).reason,
    "incomplete",
  );
  assert.equal(
    evaluateUetdsEligibility({
      driverId: "d1",
      vehicleId: "v1",
      driverKind: "registered",
      vehicleKind: "registered",
      driverCompanyId: ready?.id,
      vehicleCompanyId: "22222222-2222-2222-2222-222222222222",
    }).reason,
    "mismatch",
  );
  assert.equal(
    evaluateUetdsEligibility({
      driverId: "d1",
      vehicleId: "v1",
      driverKind: "registered",
      vehicleKind: "registered",
      driverCompanyId: ready?.id,
      vehicleCompanyId: ready?.id,
      company: mapUetdsCompanyReadiness({
        id: ready?.id,
        shortName: "Example Carrier",
        status: "inactive",
        integrationStatus: "ready",
      }),
    }).reason,
    "inactive",
  );
  assert.equal(
    evaluateUetdsEligibility({
      driverId: "d1",
      vehicleId: "v1",
      driverKind: "registered",
      vehicleKind: "registered",
      driverCompanyId: ready?.id,
      vehicleCompanyId: ready?.id,
      company: mapUetdsCompanyReadiness({
        id: ready?.id,
        shortName: "Example Carrier",
        status: "active",
        integrationStatus: "incomplete",
      }),
    }).reason,
    "not-ready",
  );
  const ok = evaluateUetdsEligibility({
    driverId: "d1",
    vehicleId: "v1",
    driverKind: "registered",
    vehicleKind: "registered",
    driverCompanyId: ready?.id,
    vehicleCompanyId: ready?.id,
    company: ready,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.companyShortName, "Example Carrier");
});

test("eligibility messages distinguish assignment vs missing company link", () => {
  const copy = uetdsFormCopy.tr;
  assert.equal(
    uetdsEligibilityMessage("unassigned", copy),
    "U-ETDS bildirimi için önce şoför ve araç atayın.",
  );
  assert.equal(
    uetdsEligibilityMessage("unassigned-driver", copy),
    "U-ETDS bildirimi için önce şoför atayın.",
  );
  assert.equal(
    uetdsEligibilityMessage("unassigned-vehicle", copy),
    "U-ETDS bildirimi için önce araç atayın.",
  );
  assert.equal(
    uetdsEligibilityMessage("external", copy),
    "Şoför ve araç için U-ETDS firma ilişkisi eksik.",
  );
  assert.equal(
    uetdsEligibilityMessage("incomplete", copy),
    "Şoför veya araç için U-ETDS firma ilişkisi eksik.",
  );
  assert.equal(
    uetdsEligibilityMessage("mismatch", copy),
    "Şoför ve araç farklı U-ETDS firmalarına kayıtlı. Lütfen kontrol edin.",
  );
  assert.doesNotMatch(copy.reasonExternal, /uygun şoför ve araç atayın/);
  assert.doesNotMatch(copy.reasonIncomplete, /uygun şoför ve araç atayın/);
});

test("shared eligibility and form are reused and do not hard-code a carrier", () => {
  for (const path of [
    "lib/uetds/eligibility.ts",
    "lib/uetds/submit.ts",
    "components/uetds/uetds-notification-form.tsx",
    "app/[locale]/partner/(panel)/uetds/notifications/new/page.tsx",
    "app/[locale]/ops/(panel)/uetds/notifications/new/page.tsx",
  ]) {
    assert.doesNotMatch(source(path), /Search Travel|Churches Travel/i);
  }
  assert.match(
    source("app/[locale]/partner/(panel)/uetds/notifications/new/page.tsx"),
    /UetdsNotificationForm/,
  );
  assert.match(
    source("app/[locale]/ops/(panel)/uetds/notifications/new/page.tsx"),
    /UetdsNotificationForm/,
  );
  assert.match(source("lib/uetds/submit.ts"), /ministry_env/);
  assert.match(source("lib/uetds/submit.ts"), /submitUetdsTestNotification/);
  assert.match(source("lib/uetds/submit.ts"), /loadUetdsMinistryCredentials/);
  assert.match(source("app/[locale]/ops/(panel)/uetds/notifications/new/page.tsx"), /ministryEnv/);
  assert.match(source("app/[locale]/partner/(panel)/uetds/notifications/new/page.tsx"), /ministryEnv/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /ministryEnv === "test"/);
  assert.doesNotMatch(source("lib/uetds/submit.ts"), /live_password_sealed/);
});

test("images larger than 1 MB can reach extraction without a 1 MB action limit", () => {
  const config = source("next.config.ts");
  assert.match(config, /serverActions/);
  assert.match(config, /bodySizeLimit:\s*"30mb"/);
  assert.match(config, /proxyClientMaxBodySize:\s*"30mb"/);
  const limits = source("lib/uetds/upload-limits.ts");
  assert.match(limits, /10 \* 1024 \* 1024/);
  const action = source("lib/uetds/notification-actions.ts");
  assert.match(action, /formData\.getAll\("files"\)/);
  assert.doesNotMatch(action, /btoa|base64/);
  assert.ok(!isOversizedUetdsFile(1.5 * 1024 * 1024));
});

test("successful structured extraction updates the form without a second fill action", () => {
  const form = source("components/uetds/uetds-notification-form.tsx");
  assert.match(form, /onDocumentFiles/);
  assert.match(form, /onAnalyzeSources|onAnalyzePaste/);
  assert.match(form, /mergeAiUetdsExtraction/);
  assert.match(form, /enrichUetdsDraftLocationsFromText/);
  assert.doesNotMatch(form, /Bilgileri forma yaz/);
  assert.match(form, /void onDocumentFiles\("images"/);
});

test("notification snapshot migration stores structured data only", () => {
  const sql = source("db/migrations/055_uetds_notifications.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS uetds_notifications/);
  assert.match(sql, /snapshot JSONB NOT NULL/);
  assert.match(sql, /partner_id UUID NOT NULL/);
  assert.doesNotMatch(sql, /BYTEA|bytea|base64|pdf|image/i);
  assert.doesNotMatch(sql, /Search Travel/i);
  const status = source("db/migrations/056_uetds_ministry_status.sql");
  assert.match(status, /submitted/);
  assert.match(status, /partial/);
});
