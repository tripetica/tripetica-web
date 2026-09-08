import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPartnerDriverLanguages,
  normalizePartnerDriverLanguageCodes,
  partnerDriverLanguageLabel,
} from "@/lib/partner/driver-languages";
import { isDriverNationalIdValid, normalizeDriverNationalId } from "@/lib/partner/driver-identity";

test("driver languages store stable codes and collapse display aliases", () => {
  assert.deepEqual(
    normalizePartnerDriverLanguageCodes(["EN", "english", "tr", "TR", "xx"]),
    ["tr", "en"],
  );
  assert.equal(partnerDriverLanguageLabel("en", "tr"), "İngilizce");
  assert.equal(partnerDriverLanguageLabel("en", "en"), "English");
  assert.equal(partnerDriverLanguageLabel("ru", "ru"), "Русский");
  assert.equal(formatPartnerDriverLanguages(["tr", "en", "ru", "de"], "tr", 2), "Türkçe, İngilizce +2");
});

test("driver national id accepts only 11 digits", () => {
  assert.equal(normalizeDriverNationalId("123 456 789 01"), "12345678901");
  assert.equal(isDriverNationalIdValid("12345678901"), true);
  assert.equal(isDriverNationalIdValid("1234567890"), false);
  assert.equal(isDriverNationalIdValid("1234567890a"), false);
});
