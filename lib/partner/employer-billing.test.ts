import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partnerCopy } from "@/lib/partner/copy";
import { PARTNER_NAV } from "@/lib/partner/nav";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const LEGAL_NAME =
  "Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi";
const TAX_OFFICE = "Güneşli Vergi Dairesi";
const TAX_NUMBER = "4880975612";
const ADDRESS =
  "15 Temmuz Mah. 1500. Sk. Ark Residence 14, D:40 Bağcılar / İstanbul";
const EMAIL = "info@tripetica.com";
const PHONE = "+90 533 205 82 19";
const AUTHORIZED = "Recep YILDIRIM";

test("partner menu uses the requested section labels", () => {
  assert.deepEqual(
    PARTNER_NAV.map((item) => item.labelKey),
    ["jobs", "accepted", "drivers", "vehicles", "uetds", "profile", "employerBilling"],
  );
  assert.equal(partnerCopy.tr.jobs, "Açık İşler");
  assert.equal(partnerCopy.tr.accepted, "İşlerim");
  assert.equal(partnerCopy.tr.drivers, "Sürücülerim");
  assert.equal(partnerCopy.tr.vehicles, "Araçlarım");
  assert.equal(partnerCopy.tr.profile, "Bilgilerim");
  assert.equal(partnerCopy.tr.employerBilling, "İşveren Fatura Bilgileri");
  assert.equal(partnerCopy.en.jobs, "Open jobs");
  assert.equal(partnerCopy.ru.jobs, "Открытые заказы");
});

test("employer billing seed lives in the singleton migration, not the UI", () => {
  const migration = source("db/migrations/032_employer_billing_profile.sql");
  assert.match(migration, /CREATE TABLE employer_billing_profile/);
  assert.match(migration, /employer_billing_profile_singleton/);
  assert.match(migration, new RegExp(LEGAL_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(migration, new RegExp(TAX_OFFICE));
  assert.match(migration, new RegExp(TAX_NUMBER));
  assert.match(migration, new RegExp(ADDRESS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(migration, new RegExp(EMAIL.replace(".", "\\.")));
  assert.match(migration, new RegExp(PHONE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(migration, new RegExp(AUTHORIZED));
  assert.match(migration, /GRANT SELECT ON TABLE employer_billing_profile/);

  const ui = [
    source("components/partner/employer-billing-card.tsx"),
    source("app/[locale]/partner/(panel)/employer-billing/page.tsx"),
    source("lib/partner/employer-billing.ts"),
  ].join("\n");
  assert.doesNotMatch(ui, /Search Travel Agency/);
  assert.doesNotMatch(ui, /4880975612/);
  assert.doesNotMatch(ui, /Recep YILDIRIM/);
  assert.doesNotMatch(ui, /<input|<textarea|<form|Kaydet/);
});
