import test from "node:test";
import assert from "node:assert/strict";
import { evaluateUetdsFinalVerification, type UetdsVerificationSummary } from "./final-verification";
import { parseUetdsBildirimOzetiXml } from "./ministry-ozet-parse";

const expected = { seferReference: "1234567890123456", plate: "34 EGP 847", groupCount: 1, personnelCount: 1, passengerCount: 3 };
const valid: UetdsVerificationSummary = { sonucKodu: 0, seferReference: expected.seferReference, seferStatusCode: 0, seferStatus: "GEÇERLİ", aracPlaka: "34EGP847", groupCount: 1, activePersonnelCount: 1, activeCount: 3 };

test("exact final match is verified; audit contains only allowlisted metadata", () => {
  const responseWithSecrets = { ...valid, username: "must-not-leak", password: "must-not-leak", rawSafe: "must-not-leak", nationalId: "must-not-leak", sonucMesaji: "must-not-leak" };
  const audit = evaluateUetdsFinalVerification(expected, responseWithSecrets, "live");
  assert.equal(audit.result, "verified");
  assert.doesNotMatch(JSON.stringify(audit), /must-not-leak/);
  assert.deepEqual(audit.reasons, []);
  assert.equal(audit.expected.plate, "34EGP847");
  assert.equal(audit.actual.plate, "34EGP847");
  assert.ok(Number.isFinite(Date.parse(audit.timestamp)));
  assert.equal(audit.environment, "live");
  assert.doesNotMatch(JSON.stringify(audit), /password|username|identity|nationalId|firstName|rawSafe|sonucMesaji/);
});

for (const [name, changes, reason] of [
  ["nonzero result", { sonucKodu: 99 }, "summary-unavailable"],
  ["trip missing", { seferStatusCode: null, aracPlaka: null }, "trip-not-found"],
  ["cancelled", { seferStatusCode: 1, seferStatus: "İPTAL" }, "trip-not-valid"],
  ["unknown status", { seferStatus: null }, "trip-not-valid"],
  ["wrong reference", { seferReference: "9999999999999999" }, "reference-mismatch"],
  ["wrong plate", { aracPlaka: "34ABC123" }, "plate-mismatch"],
  ["wrong group count", { groupCount: 2 }, "group-count-mismatch"],
  ["wrong personnel count", { activePersonnelCount: 0 }, "personnel-count-mismatch"],
  ["wrong passenger count", { activeCount: 2 }, "passenger-count-mismatch"],
] as const) {
  test(`${name} never gives final success`, () => {
    const audit = evaluateUetdsFinalVerification(expected, { ...valid, ...changes }, "test");
    assert.equal(audit.result, "final-verification-failed");
    assert.ok(audit.reasons.includes(reason));
  });
}

test("network failure does not confirm success", () => {
  assert.equal(evaluateUetdsFinalVerification(expected, null, "live").result, "final-verification-failed");
});

test("official summary without a response reference verifies all other criteria", () => {
  const parsed = parseUetdsBildirimOzetiXml(`<return><seferDurumKodu>0</seferDurumKodu><seferDurumAciklama>GEÇERLİ</seferDurumAciklama><aracPlaka>34EGP847</aracPlaka><grupListesi><grupId>123</grupId><uetdsSeferReferansNo>${expected.seferReference}</uetdsSeferReferansNo></grupListesi><ariziPersonelListesi><durumAciklama>Geçerli</durumAciklama></ariziPersonelListesi>${Array.from({length: 3}, () => '<ariziYolcuListesi><durumAciklama>Geçerli</durumAciklama></ariziYolcuListesi>').join('')}</return>`);
  assert.equal(parsed.seferReference, null);
  assert.equal(parsed.groupCount, 1);
  assert.equal(parsed.activePersonnelCount, 1);
  assert.equal(parsed.activeCount, 3);
  const audit = evaluateUetdsFinalVerification(expected, { ...parsed, sonucKodu: 0 }, "live");
  assert.equal(audit.result, "verified");
  assert.deepEqual(audit.reasons, []);
  assert.equal(audit.actual.seferReference, null);
});

test("omitted reference does not bypass the remaining verification checks", () => {
  const { seferReference: _reference, ...withoutReference } = valid;
  const summary = withoutReference as UetdsVerificationSummary;
  assert.equal(evaluateUetdsFinalVerification(expected, summary, "live").result, "verified");
  assert.deepEqual(evaluateUetdsFinalVerification(expected, { ...summary, activeCount: 0 }, "live").reasons, ["passenger-count-mismatch"]);
});


test("empty or nil group placeholders do not count as created groups", () => {
  assert.equal(parseUetdsBildirimOzetiXml('<return><grupListesi xsi:nil="true" /></return>').groupCount, 0);
  assert.equal(parseUetdsBildirimOzetiXml('<return><grupListesi></grupListesi></return>').groupCount, 0);
});
