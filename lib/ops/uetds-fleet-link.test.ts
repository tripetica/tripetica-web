import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { asPanelLocale, panelLocales } from "@/lib/i18n/config";
import { opsCopy } from "@/lib/ops/copy";
import { UETDS_NOTIFY_NONE_VALUE } from "@/lib/ops/uetds-company-fields";
import { buildUetdsCompanySelectOptions } from "@/lib/ops/uetds-company-options-view";
import { matchUetdsNotificationCompanies } from "@/lib/ops/uetds-notification-match";
import { formatUetdsCompanyListLabel } from "@/lib/partner/fleet-view";
import { partnerCopy } from "@/lib/partner/copy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const CREDENTIAL_LEAK = /password_sealed|test_username|live_username|unsealSecret|UETDS_CREDENTIALS_KEY/;

test("uetds notification match is same-company only and does not hard-code carriers", () => {
  assert.deepEqual(matchUetdsNotificationCompanies("a", "a"), {
    status: "eligible",
    companyId: "a",
  });
  assert.deepEqual(matchUetdsNotificationCompanies("a", "b"), { status: "mismatch" });
  assert.deepEqual(matchUetdsNotificationCompanies(null, null), { status: "external" });
  assert.deepEqual(matchUetdsNotificationCompanies("", "  "), { status: "external" });
  assert.deepEqual(matchUetdsNotificationCompanies("a", null), { status: "incomplete" });
  assert.deepEqual(matchUetdsNotificationCompanies(null, "b"), { status: "incomplete" });
  assert.doesNotMatch(source("lib/ops/uetds-notification-match.ts"), /Search Travel|Churches Travel/i);
});

test("uetds company select options keep none as empty and retain an inactive current company", () => {
  const active = [
    { id: "2", shortName: "Beta" },
    { id: "1", shortName: "Alpha" },
  ];
  const options = buildUetdsCompanySelectOptions(active, { id: "9", shortName: "Legacy" }, "None");
  assert.deepEqual(options[0], { value: UETDS_NOTIFY_NONE_VALUE, label: "None" });
  assert.equal(UETDS_NOTIFY_NONE_VALUE, "");
  assert.deepEqual(
    options.map((option) => option.value),
    ["", "2", "1", "9"],
  );
  const activeCurrent = buildUetdsCompanySelectOptions(
    active,
    { id: "1", shortName: "Alpha" },
    "None",
  );
  assert.equal(activeCurrent.filter((option) => option.value === "1").length, 1);
});

test("fleet uetds migration is nullable, additive, and does not backfill", () => {
  const sql = source("db/migrations/054_partner_fleet_uetds_company.sql");
  assert.match(sql, /ALTER TABLE partner_drivers/);
  assert.match(sql, /ALTER TABLE partner_vehicles/);
  assert.match(sql, /uetds_company_id UUID REFERENCES uetds_companies \(id\)/);
  assert.doesNotMatch(sql, /NOT NULL/);
  assert.doesNotMatch(sql, /INSERT INTO/);
  assert.doesNotMatch(sql, /UPDATE partner_drivers/);
  assert.doesNotMatch(sql, /UPDATE partner_vehicles/);
  assert.doesNotMatch(sql, /Search Travel|Churches Travel/i);
});

test("driver and vehicle stores expose company id and short name only", () => {
  for (const path of ["lib/partner/fleet.ts", "lib/ops/drivers.ts", "lib/ops/vehicles.ts"]) {
    const text = source(path);
    assert.match(text, /uetds_company_id/);
    assert.match(text, /short_name/);
    assert.doesNotMatch(text, CREDENTIAL_LEAK);
  }
  const options = source("lib/ops/uetds-company-options.ts");
  assert.match(options, /short_name/);
  assert.match(options, /status = 'active'/);
  assert.match(options, /currentId && input\.requestedId === input\.currentId/);
  assert.doesNotMatch(options, CREDENTIAL_LEAK);
});

test("ops and partner fleet forms bind the shared uetds company select", () => {
  const forms = [
    "components/ops/partner-driver-form.tsx",
    "components/ops/partner-vehicle-form.tsx",
    "components/partner/driver-create-form.tsx",
    "components/partner/vehicle-create-form.tsx",
    "components/partner/driver-detail.tsx",
    "components/partner/vehicle-detail.tsx",
  ];
  for (const path of forms) {
    const text = source(path);
    assert.match(text, /UetdsCompanySelect/);
    assert.match(text, /uetdsNotifyNone/);
    assert.doesNotMatch(text, CREDENTIAL_LEAK);
    assert.doesNotMatch(text, /Search Travel/);
  }
  assert.match(source("lib/partner/driver-actions.ts"), /resolveUetdsCompanyIdFromForm/);
  assert.match(source("lib/partner/driver-actions.ts"), /actor\.partnerId/);
  assert.match(source("lib/partner/vehicle-actions.ts"), /resolveUetdsCompanyIdFromForm/);
  assert.match(source("lib/partner/vehicle-actions.ts"), /actor\.partnerId/);
  assert.match(source("lib/ops/partner-fleet-actions.ts"), /resolveUetdsCompanyIdFromForm/);
  assert.doesNotMatch(source("lib/ops/partner-fleet-actions.ts"), /createPartnerDriver/);
  assert.doesNotMatch(source("lib/ops/partner-fleet-actions.ts"), /createPartnerVehicle/);
});

test("uetds fleet copy stays complete and official none label is exact", () => {
  assert.equal(opsCopy.tr.uetdsNotifyCompany, "U-ETDS Bildirim Firması");
  assert.equal(opsCopy.tr.uetdsNotifyNone, "Tripetica üzerinden bildirim yapılmaz");
  assert.equal(opsCopy.tr.uetdsCompanyColumn, "U-ETDS Firması");
  assert.equal(opsCopy.tr.uetdsCompanyExternal, "Harici");
  assert.equal(partnerCopy.tr.uetdsNotifyNone, "Tripetica üzerinden bildirim yapılmaz");
  assert.equal(partnerCopy.tr.uetdsCompanyExternal, "Harici");
  for (const locale of panelLocales) {
    const ops = opsCopy[asPanelLocale(locale)];
    const partner = partnerCopy[asPanelLocale(locale)];
    assert.ok(ops.uetdsNotifyCompany);
    assert.ok(ops.uetdsNotifyNone);
    assert.ok(ops.uetdsCompanyColumn);
    assert.ok(ops.uetdsCompanyExternal);
    assert.ok(ops.invalidUetdsCompany);
    assert.ok(partner.uetdsNotifyCompany);
    assert.ok(partner.uetdsNotifyNone);
    assert.ok(partner.uetdsCompanyColumn);
    assert.ok(partner.uetdsCompanyExternal);
    assert.ok(partner.invalidUetdsCompany);
  }
});

test("fleet lists show short company name or Harici and keep inactive names", () => {
  assert.equal(
    formatUetdsCompanyListLabel({ id: "1", shortName: "SEARCH TRAVEL" }, "Harici"),
    "SEARCH TRAVEL",
  );
  assert.equal(formatUetdsCompanyListLabel(null, "Harici"), "Harici");
  assert.equal(formatUetdsCompanyListLabel({ id: "1", shortName: "  " }, "Harici"), "Harici");
  const inlineLists = [
    "components/partner/driver-list.tsx",
    "components/partner/vehicle-list.tsx",
    "components/ops/driver-table.tsx",
    "components/ops/vehicle-table.tsx",
  ];
  for (const path of inlineLists) {
    const text = source(path);
    assert.match(text, /uetdsCompanyColumn/);
    assert.match(text, /FleetInlineSelect/);
    assert.match(text, /companyChoicesForRow\(companies,/);
    assert.match(text, /fleetChoicesForPartner\(fleetChoices,/);
    assert.doesNotMatch(text, CREDENTIAL_LEAK);
    assert.doesNotMatch(text, /UetdsCompanySelect/);
  }
  const partnerFleet = source("components/ops/partner-fleet-table.tsx");
  assert.match(partnerFleet, /uetdsCompanyColumn/);
  assert.match(partnerFleet, /formatUetdsCompanyListLabel/);
  assert.doesNotMatch(partnerFleet, CREDENTIAL_LEAK);
  assert.doesNotMatch(partnerFleet, /UetdsCompanySelect/);
});
