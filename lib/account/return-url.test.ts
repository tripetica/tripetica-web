import assert from "node:assert/strict";
import { test } from "node:test";
import { isAccountAreaPath, sanitizeReturnPath } from "./return-url";
import { formatAccountHeaderInitial, formatAccountHeaderName } from "./format";

test("sanitizeReturnPath accepts internal paths only", () => {
  assert.equal(sanitizeReturnPath("/booking"), "/booking");
  assert.equal(sanitizeReturnPath("/tr/booking"), "/booking");
  assert.equal(sanitizeReturnPath("https://evil.com"), null);
  assert.equal(sanitizeReturnPath("//evil.com"), null);
  assert.equal(sanitizeReturnPath("/ops/reservations"), null);
  assert.equal(sanitizeReturnPath("/api/booking/draft"), null);
});

test("isAccountAreaPath detects account routes", () => {
  assert.equal(isAccountAreaPath("/account"), true);
  assert.equal(isAccountAreaPath("/account/reservations"), true);
  assert.equal(isAccountAreaPath("/account/profile"), true);
  assert.equal(isAccountAreaPath("/"), false);
  assert.equal(isAccountAreaPath("/booking"), false);
});

test("header name uses first name + last initial", () => {
  assert.equal(formatAccountHeaderName("Recep", "Yıldırım"), "Recep Y.");
  assert.equal(formatAccountHeaderName("Ada", "Lovelace"), "Ada L.");
});

test("header initial uses first-name letter only", () => {
  assert.equal(formatAccountHeaderInitial("Trip", "Etica"), "T");
  assert.equal(formatAccountHeaderInitial("recep", "Yıldırım"), "R");
  assert.equal(formatAccountHeaderInitial("", "Yıldırım"), "Y");
});
