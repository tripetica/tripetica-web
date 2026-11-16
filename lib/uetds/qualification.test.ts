import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isTurkishIdentityNumber,
  qualificationOutcomeFromXml,
  qualificationSrcReady,
} from "@/lib/uetds/qualification";

const today = "2026-11-06";

function xml(body: string) {
  return `<return>${body}</return>`;
}

test("identity numbers use the ministry checksum", () => {
  assert.equal(isTurkishIdentityNumber("10000000146"), true);
  assert.equal(isTurkishIdentityNumber("10000000145"), false);
  assert.equal(isTurkishIdentityNumber("01234567890"), false);
});

test("a successful SRC code is valid and has no invented number or date", () => {
  const outcome = qualificationOutcomeFromXml(xml("<sonucKodu>0</sonucKodu><sonucMesaji>İŞLEM BAŞARILI</sonucMesaji><belgeListesi>SRC1</belgeListesi>"), today);
  assert.equal(outcome.status, "verified");
  if (outcome.status !== "verified") return;
  assert.equal(outcome.srcReady, true);
  assert.deepEqual(outcome.documents, [{ type: "SRC1", status: "valid", number: null, expiresOn: null }]);
});

test("SRC2 alone and both SRC codes satisfy passenger transport", () => {
  const src2 = qualificationOutcomeFromXml(xml("<sonucKodu>0</sonucKodu><belgeListesi>SRC2</belgeListesi>"), today);
  const both = qualificationOutcomeFromXml(xml("<sonucKodu>0</sonucKodu><belgeListesi>SRC1</belgeListesi><belgeListesi>SRC2</belgeListesi>"), today);
  assert.equal(src2.status === "verified" && src2.srcReady, true);
  assert.equal(both.status === "verified" && both.documents.length === 2 && both.srcReady, true);
});

test("other returned certificates stay visible and do not invent missing SRC rows", () => {
  const outcome = qualificationOutcomeFromXml(xml("<sonucKodu>0</sonucKodu><belgeListesi>SRC3</belgeListesi><belgeListesi>ÜDY1</belgeListesi>"), today);
  assert.equal(outcome.status, "verified");
  if (outcome.status !== "verified") return;
  assert.deepEqual(outcome.documents.map((item) => item.type), ["SRC3", "ÜDY1"]);
  assert.equal(outcome.srcReady, false);
});

test("an expired or cancelled certificate does not count as valid SRC", () => {
  const expired = qualificationOutcomeFromXml(xml("<sonucKodu>0</sonucKodu><belgeListesi>SRC1 01.01.2020</belgeListesi>"), today);
  const cancelled = qualificationOutcomeFromXml(xml("<sonucKodu>0</sonucKodu><belgeListesi>SRC2 IPTAL</belgeListesi>"), today);
  assert.equal(expired.status === "verified" && expired.srcReady, false);
  assert.equal(expired.status === "verified" && expired.documents[0]?.expiresOn, "2020-01-01");
  assert.equal(cancelled.status === "verified" && cancelled.documents[0]?.status, "invalid");
  assert.equal(qualificationSrcReady([]), false);
});

test("the new driver form requires a company and confirms an unverified or missing SRC result", () => {
  const form = readFileSync("components/partner/driver-create-form.tsx", "utf8");
  const store = readFileSync("lib/uetds/qualification-store.ts", "utf8");
  const actions = readFileSync("lib/partner/driver-qualification-actions.ts", "utf8");
  assert.match(form, /includeNone=\{false\}/);
  assert.doesNotMatch(form, /SRC Sorgula/);
  assert.match(form, /qualificationSaveAnyway/);
  assert.match(form, /newDriverPermissions\(\)/);
  assert.match(store, /SET attempted_at = NOW\(\)/);
  assert.doesNotMatch(store, /SET documents = '\[\]'/);
  assert.match(actions, /getPartnerDriver\(actor\.partnerId, driverId\)/);
  assert.match(actions, /partnerHasTab\(actor, "drivers"\)/);
});

test("authorization and transport faults are unverified rather than missing documents", () => {
  const fault = qualificationOutcomeFromXml("<soap:Fault><faultstring>Yetki Hatası</faultstring></soap:Fault>", today);
  const rejected = qualificationOutcomeFromXml(xml("<sonucKodu>5</sonucKodu><sonucMesaji>Hata</sonucMesaji>"), today);
  assert.equal(fault.status, "unverified");
  assert.equal(rejected.status, "unverified");
});
