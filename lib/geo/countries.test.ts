import test from "node:test";
import assert from "node:assert/strict";
import {
  countries,
  countryByIso2,
  countryCount,
  countryDialCode,
  countryFlagEmoji,
  countryName,
  formatDialCode,
  searchCountries,
} from "@/lib/geo/countries";
import { phoneFieldCopy } from "@/lib/geo/copy";

test("catalog covers a full ISO set with TR/EN/RU/AR names and dial codes", () => {
  assert.equal(countryCount(), 250);
  assert.equal(countries().length, countryCount());
  for (const country of countries()) {
    assert.match(country.iso2, /^[A-Z]{2}$/);
    assert.match(country.dialCode, /^\d+$/);
    assert.ok(country.names.tr.length > 0);
    assert.ok(country.names.en.length > 0);
    assert.ok(country.names.ru.length > 0);
    assert.ok(country.names.ar.length > 0);
  }
});

test("ISO alpha-2 lookup returns localized names and dial codes", () => {
  assert.equal(countryName("TR", "tr"), "Türkiye");
  assert.equal(countryName("TR", "en"), "Turkey");
  assert.equal(countryName("TR", "ru"), "Турция");
  assert.equal(countryName("TR", "ar"), "تركيا");
  assert.equal(countryDialCode("tr"), "90");
  assert.equal(formatDialCode("TR"), "+90");

  assert.equal(countryName("RU", "tr"), "Rusya");
  assert.equal(countryName("RU", "en"), "Russia");
  assert.equal(countryName("RU", "ru"), "Россия");
  assert.equal(formatDialCode("RU"), "+7");

  assert.equal(countryName("DE", "tr"), "Almanya");
  assert.equal(countryName("DE", "en"), "Germany");
  assert.equal(countryName("DE", "ru"), "Германия");
  assert.equal(formatDialCode("DE"), "+49");

  assert.equal(formatDialCode("XK"), "+383");
  assert.equal(formatDialCode("MC"), "+377");
});

test("search uses the active locale country names", () => {
  assert.equal(searchCountries("Almanya", "tr")[0]?.iso2, "DE");
  assert.equal(searchCountries("Germany", "en")[0]?.iso2, "DE");
  assert.equal(searchCountries("Германия", "ru")[0]?.iso2, "DE");
  assert.equal(searchCountries("ألمانيا", "ar")[0]?.iso2, "DE");
  assert.equal(searchCountries("ABD", "tr")[0]?.iso2, "US");
});

test("nationality ISO code and phone dial code stay independently readable", () => {
  const nationality = countryByIso2("RU");
  const phone = countryByIso2("TR");
  assert.equal(nationality?.iso2, "RU");
  assert.equal(formatDialCode(phone?.iso2), "+90");
  assert.notEqual(nationality?.iso2, phone?.iso2);
});

test("flag emoji is derived from ISO alpha-2", () => {
  assert.equal(countryFlagEmoji("TR"), "🇹🇷");
  assert.equal(countryFlagEmoji("RU"), "🇷🇺");
  assert.equal(countryFlagEmoji("DE"), "🇩🇪");
});

test("phone copy has no numeric placeholder", () => {
  for (const locale of ["tr", "en", "ru", "ar"] as const) {
    assert.equal(/\d/.test(phoneFieldCopy[locale].phonePlaceholder), false);
  }
  assert.match(phoneFieldCopy.tr.selectCode, /Kod/);
  assert.match(phoneFieldCopy.en.selectCode, /Select/);
  assert.match(phoneFieldCopy.ru.selectCode, /Выберите/);
  assert.match(phoneFieldCopy.ar.selectCode, /اختر|رمز/);
});
