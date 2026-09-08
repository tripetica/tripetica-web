import test from "node:test";
import assert from "node:assert/strict";
import {
  localizeVoucherAddressCountry,
  voucherTurkeyCountryLabel,
} from "@/lib/booking/voucher-address";

test("voucher Turkey label follows locale (EN uses Türkiye)", () => {
  assert.equal(voucherTurkeyCountryLabel("tr"), "Türkiye");
  assert.equal(voucherTurkeyCountryLabel("en"), "Türkiye");
  assert.equal(voucherTurkeyCountryLabel("ru"), "Турция");
});

test("TR voucher replaces Russian Turkey country remnant", () => {
  assert.equal(
    localizeVoucherAddressCountry(
      "Tayakadın, Terminal Caddesi No:1, 34283 Arnavutköy/İstanbul, Турция",
      "tr",
    ),
    "Tayakadın, Terminal Caddesi No:1, 34283 Arnavutköy/İstanbul, Türkiye",
  );
});

test("RU voucher normalizes English/Turkish Turkey to Турция", () => {
  assert.equal(
    localizeVoucherAddressCountry("Pendik/İstanbul, Turkey", "ru"),
    "Pendik/İstanbul, Турция",
  );
  assert.equal(
    localizeVoucherAddressCountry("Pendik/İstanbul, Türkiye", "ru"),
    "Pendik/İstanbul, Турция",
  );
});

test("EN voucher uses Türkiye for country display", () => {
  assert.equal(
    localizeVoucherAddressCountry("Antalya, Турция", "en"),
    "Antalya, Türkiye",
  );
});
