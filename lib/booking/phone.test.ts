import test from "node:test";
import assert from "node:assert/strict";
import {
  emailValidity,
  formatNationalInput,
  fromStoredPhone,
  isValidEmail,
  phoneValidity,
  toE164,
} from "@/lib/booking/phone";

test("Turkey local number becomes E.164 without spaces or trunk zero", () => {
  assert.equal(toE164("TR", "532 123 45 67"), "+905321234567");
  assert.equal(toE164("TR", "0532 123 45 67"), "+905321234567");
  assert.equal(toE164("TR", "+90 532-123-45-67"), "+905321234567");
});

test("phone country and nationality stay independent in helpers", () => {
  assert.equal(toE164("TR", "5321234567"), "+905321234567");
  const parsed = fromStoredPhone("RU", "+79001234567");
  assert.equal(parsed.iso2, "RU");
  assert.equal(parsed.national.replace(/\D/g, ""), "9001234567");
});

test("missing country or national digits do not invent a number", () => {
  assert.equal(toE164(null, "5321234567"), null);
  assert.equal(toE164("TR", ""), null);
  assert.equal(fromStoredPhone(null, null).iso2, null);
});

test("incomplete or invalid numbers are not stored as E.164", () => {
  assert.equal(toE164("TR", "533"), null);
  assert.equal(toE164("TR", "533205821901234"), null);
  assert.equal(phoneValidity("TR", "533"), "too_short");
  assert.equal(phoneValidity("TR", "5332058219"), "valid");
});

test("national input formats by selected country metadata", () => {
  assert.equal(formatNationalInput("TR", "5332058219"), "533 205 82 19");
  assert.equal(formatNationalInput("US", "2025550123"), "(202) 555-0123");
  assert.equal(formatNationalInput("RU", "9123456789"), "912 345-67-89");
  assert.equal(formatNationalInput("DE", "15123456789").replace(/\D/g, ""), "15123456789");
  assert.notEqual(formatNationalInput("US", "2025550123"), formatNationalInput("TR", "2025550123"));
});

test("too-long national digits are capped by country metadata", () => {
  assert.equal(formatNationalInput("US", "20255501239999").replace(/\D/g, ""), "2025550123");
  assert.equal(phoneValidity("US", "20255501234"), "too_long");
});

test("email validity distinguishes empty, invalid, and complete addresses", () => {
  assert.equal(emailValidity(""), "empty");
  assert.equal(emailValidity("   "), "empty");
  assert.equal(emailValidity("not-an-email"), "invalid");
  assert.equal(emailValidity("tripetica@gmail.c"), "invalid");
  assert.equal(emailValidity("tripetica@gmail.co"), "valid");
  assert.equal(emailValidity("name@company.co"), "valid");
  assert.equal(emailValidity("tripetica@gmail.com"), "valid");
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("tripetica@gmail.co"), true);
  assert.equal(isValidEmail(""), false);
});
