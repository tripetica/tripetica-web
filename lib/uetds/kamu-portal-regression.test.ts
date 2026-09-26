import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relative: string) {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

test("create/submit path still uses SOAP yolcuEkle and is untouched by kamu portal", () => {
  const submit = source("lib/uetds/submit.ts");
  const ministrySubmit = source("lib/uetds/ministry-submit.ts");
  assert.match(ministrySubmit, /yolcuEkle/);
  assert.doesNotMatch(submit, /kamu-portal|kamuYolcuGuncelle|updateEditedPassengersViaKamu/);
  assert.doesNotMatch(ministrySubmit, /kamu-portal|kamuYolcuGuncelle/);
});

test("manage EDITED_EXISTING uses SOAP iptal+ekle correction (no kamu branch in form path)", () => {
  const manage = source("lib/uetds/manage.ts");
  assert.doesNotMatch(manage, /companyUsesKamuPassengerUpdate/);
  assert.doesNotMatch(manage, /updateEditedPassengersViaKamuPortal/);
  assert.doesNotMatch(manage, /useKamuPassengerUpdate/);
  assert.match(manage, /mutateUetdsYolcuIptalByRef/);
  assert.match(manage, /mutateUetdsYolcuEkle/);
  assert.match(manage, /Yolcu bilgisi duzeltme/);
});

test("Ops and Partner edit pages share the same edit form / action without cookie UX", () => {
  const ops = source("app/[locale]/ops/(panel)/uetds/notifications/[id]/edit/page.tsx");
  const partner = source("app/[locale]/partner/(panel)/uetds/notifications/[id]/edit/page.tsx");
  assert.match(ops, /UetdsNotificationEditForm/);
  assert.match(partner, /UetdsNotificationEditForm/);
  assert.doesNotMatch(ops, /kamuPassengerUpdateRequired/);
  assert.doesNotMatch(partner, /kamuPassengerUpdateRequired/);
  assert.doesNotMatch(ops, /companyUsesKamuPassengerUpdate/);
  assert.doesNotMatch(partner, /companyUsesKamuPassengerUpdate/);
  const form = source("components/uetds/uetds-notification-edit-form.tsx");
  assert.match(form, /updateUetdsNotificationAction/);
  assert.doesNotMatch(form, /UetdsKamuSessionAssist/);
  assert.match(form, /mounted \? JSON\.stringify\(draft\) : ""/);
  assert.match(form, /type=\{mounted \? "date" : "text"\}/);
});

test("edit method chooser is wired on detail; cookie assist code retained but unused in UX", () => {
  const detail = source("components/uetds/uetds-notification-detail.tsx");
  assert.match(detail, /UetdsEditMethodModal/);
  assert.match(detail, /resolveKamuEditDeepLink/);
  assert.match(detail, /editMethodOpen/);
  const assist = source("components/uetds/uetds-kamu-session-assist.tsx");
  assert.match(assist, /bindKamuPortalSessionAction/);
  const session = source("lib/uetds/kamu-portal/session.ts");
  assert.match(session, /isDevDatabase/);
});

test("session bind is DEV-only and never uses browser storage APIs", () => {
  const session = source("lib/uetds/kamu-portal/session.ts");
  assert.match(session, /isDevDatabase/);
  assert.match(session, /password/);
  assert.doesNotMatch(session, /localStorage|sessionStorage/);
});

test("Kamu login opens portal home, not a hard-coded OAuth URL", () => {
  const assist = source("components/uetds/uetds-kamu-session-assist.tsx");
  const html = source("lib/uetds/kamu-portal/html.ts");
  assert.match(html, /KAMU_PORTAL_HOME\s*=\s*"https:\/\/kamu\.turkiye\.gov\.tr"/);
  assert.match(assist, /KAMU_PORTAL_HOME/);
  assert.doesNotMatch(assist, /oauthClientId|giris\.turkiye\.gov\.tr\/Giris/);
  assert.doesNotMatch(assist, /window\.open\([^)]*noopener/);
});

test("deep-link helper never invents index or grupIndex", () => {
  const deep = source("lib/uetds/kamu-portal/deep-link.ts");
  assert.match(deep, /seferListesi/);
  assert.doesNotMatch(deep, /index=\d+|grupIndex=\d+/);
  assert.match(deep, /matchedSefer: false/);
});
