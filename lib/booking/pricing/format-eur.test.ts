import assert from "node:assert/strict";
import { test } from "node:test";
import {
  currencyTotalsFromEur,
  formatAmountDigits,
  formatCurrencyPill,
  formatEurAmount,
  normalizeDisplayCurrency,
} from "./format-eur";

test("display currency defaults to USD", () => {
  assert.equal(normalizeDisplayCurrency(null), "USD");
  assert.equal(normalizeDisplayCurrency("EUR"), "EUR");
  assert.equal(normalizeDisplayCurrency("eur"), "USD");
});

test("EUR totals keep other currencies unset", () => {
  const totals = currencyTotalsFromEur(95.81);
  assert.deepEqual(
    totals.map((item) => item.code),
    ["USD", "EUR", "TRY", "RUB", "GBP"],
  );
  assert.equal(totals[0]?.amount, null);
  assert.equal(totals[1]?.amount, 95.81);
});

test("pills use locale decimals and never show zero for a missing rate", () => {
  assert.equal(formatCurrencyPill("USD", null, "tr"), "$ —");
  assert.equal(formatCurrencyPill("EUR", 95.81, "tr"), "€ 95,81");
  assert.equal(formatCurrencyPill("EUR", 95.81, "en"), "€ 95.81");
  assert.equal(formatCurrencyPill("TRY", 10094.78, "tr"), "₺ 10.094,78");
  assert.equal(formatCurrencyPill("RUB", 5165, "ru"), "₽ 5 165");
  assert.equal(formatAmountDigits(80.81, "ru"), "80,81");
  assert.equal(formatEurAmount(80.81, "tr"), "80,81 €");
  assert.equal(formatEurAmount(27.37, "tr"), "27,37 €");
  assert.equal(formatEurAmount(27.37, "ru"), "27,37 €");
});

test("display currency selection is independent of locale text", () => {
  assert.equal(normalizeDisplayCurrency("RUB"), "RUB");
  assert.equal(normalizeDisplayCurrency("TRY"), "TRY");
  assert.equal(normalizeDisplayCurrency("GBP"), "GBP");
});
