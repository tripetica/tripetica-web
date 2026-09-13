import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDialCode } from "@/lib/geo/countries";
import {
  defaultCountryIso2ForLocale,
  resolveCountryIso2WithLocaleDefault,
} from "@/lib/geo/locale-defaults";

test("locale defaults map to RU / TR / GB / SA", () => {
  assert.equal(defaultCountryIso2ForLocale("ru"), "RU");
  assert.equal(defaultCountryIso2ForLocale("tr"), "TR");
  assert.equal(defaultCountryIso2ForLocale("en"), "GB");
  assert.equal(defaultCountryIso2ForLocale("ar"), "SA");
  assert.equal(formatDialCode("RU"), "+7");
  assert.equal(formatDialCode("TR"), "+90");
  assert.equal(formatDialCode("GB"), "+44");
  assert.equal(formatDialCode("SA"), "+966");
});

test("stored country is not overwritten by locale default", () => {
  assert.equal(resolveCountryIso2WithLocaleDefault("TR", "ru"), "TR");
  assert.equal(resolveCountryIso2WithLocaleDefault("us", "tr"), "US");
  assert.equal(resolveCountryIso2WithLocaleDefault(null, "en"), "GB");
  assert.equal(resolveCountryIso2WithLocaleDefault("", "ru"), "RU");
});
