import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { asPanelLocale, panelLocales } from "@/lib/i18n/config";
import { partnerCopy } from "@/lib/partner/copy";
import { PARTNER_NAV } from "@/lib/partner/nav";
import { isUetdsSubnavCurrent } from "@/components/ops/uetds-subnav";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const FORBIDDEN = /uetdsCompanies|uetdsNewCompany|password_sealed|test_username|live_username|unsealSecret|WSDL|wsdl/;

test("partner uetds sits between vehicles and profile", () => {
  assert.deepEqual(
    PARTNER_NAV.map((item) => item.href),
    [
      "/partner/jobs",
      "/partner/accepted",
      "/partner/drivers",
      "/partner/vehicles",
      "/partner/uetds",
      "/partner/profile",
      "/partner/employer-billing",
    ],
  );
  assert.equal(partnerCopy.tr.uetds, "U-ETDS");
  assert.equal(partnerCopy.tr.uetdsTitle, "U-ETDS Bildirim İşlemleri");
  assert.equal(partnerCopy.tr.uetdsNewNotification, "Yeni Bildirim");
  assert.equal(partnerCopy.tr.uetdsMyNotifications, "Bildirimlerim");
  for (const locale of panelLocales) {
    const copy = partnerCopy[asPanelLocale(locale)];
    assert.ok(copy.uetds);
    assert.ok(copy.uetdsTitle);
    assert.ok(copy.uetdsNewNotification);
    assert.ok(copy.uetdsMyNotifications);
    assert.ok(copy.uetdsEmptyNewNotification);
    assert.ok(copy.uetdsEmptyNotifications);
  }
});

test("partner uetds has no company management and stays partner-scoped", () => {
  const files = [
    "app/[locale]/partner/(panel)/uetds/layout.tsx",
    "app/[locale]/partner/(panel)/uetds/page.tsx",
    "app/[locale]/partner/(panel)/uetds/notifications/page.tsx",
    "app/[locale]/partner/(panel)/uetds/notifications/new/page.tsx",
    "app/[locale]/partner/(panel)/uetds/notifications/[id]/page.tsx",
    "lib/partner/uetds-notifications.ts",
  ];
  for (const path of files) {
    const text = source(path);
    assert.doesNotMatch(text, FORBIDDEN);
    assert.doesNotMatch(text, /UetdsCompaniesScreen|uetds-company-dialog/);
  }
  const layout = source("app/[locale]/partner/(panel)/uetds/layout.tsx");
  assert.match(layout, /requirePartnerPage/);
  assert.match(layout, /uetdsNewNotification/);
  assert.match(layout, /uetdsMyNotifications/);
  assert.doesNotMatch(layout, /\/ops\/uetds\/companies|uetdsCompanies/);
  assert.match(source("app/[locale]/partner/(panel)/uetds/notifications/page.tsx"), /listPartnerUetdsNotifications\(actor\.partnerId, search, filters\)/);
  assert.match(
    source("app/[locale]/partner/(panel)/uetds/notifications/[id]/page.tsx"),
    /getPartnerUetdsNotification\(actor\.partnerId, id\)/,
  );
  const store = source("lib/partner/uetds-notifications.ts");
  assert.match(store, /server-only/);
  assert.match(store, /listUetdsNotifications\(\{ partnerId, query: search, filters \}\)/);
  assert.match(store, /getUetdsNotification\(\{ id: notificationId, partnerId \}\)/);
  assert.doesNotMatch(store, FORBIDDEN);
});

test("shared uetds tabs keep new-notification distinct from the list", () => {
  assert.equal(
    isUetdsSubnavCurrent("/partner/uetds/notifications", "/partner/uetds/notifications/new"),
    false,
  );
  assert.equal(
    isUetdsSubnavCurrent("/partner/uetds/notifications/new", "/partner/uetds/notifications/new"),
    true,
  );
  assert.equal(
    isUetdsSubnavCurrent("/ops/uetds/notifications", "/ops/uetds/notifications/new"),
    false,
  );
  assert.equal(isUetdsSubnavCurrent("/ops/uetds/companies", "/ops/uetds/companies"), true);
});
