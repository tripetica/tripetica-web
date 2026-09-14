import test from "node:test";
import assert from "node:assert/strict";
import {
  formatOpsAmount,
  formatOpsOtherPrice,
  formatOpsSelectedPrice,
  otherStoredAmounts,
  parseOpsAmount,
  selectedStoredAmount,
} from "@/lib/ops/money";

const snapshot = {
  baseCurrency: "EUR" as const,
  totalEur: "69.98",
  capturedAt: "2026-08-28T03:42:00.000Z",
  rates: {
    USD: {
      quoteCurrency: "USD" as const,
      rate: "1.1545",
      source: "test",
      fetchedAt: "2026-08-28T03:42:00.000Z",
    },
    EUR: {
      quoteCurrency: "EUR" as const,
      rate: "1",
      source: "test",
      fetchedAt: "2026-08-28T03:42:00.000Z",
    },
    TRY: {
      quoteCurrency: "TRY" as const,
      rate: "65.64",
      source: "test",
      fetchedAt: "2026-08-28T03:42:00.000Z",
    },
    RUB: {
      quoteCurrency: "RUB" as const,
      rate: "122.21",
      source: "test",
      fetchedAt: "2026-08-28T03:42:00.000Z",
    },
    GBP: {
      quoteCurrency: "GBP" as const,
      rate: "1.0004",
      source: "test",
      fetchedAt: "2026-08-28T03:42:00.000Z",
    },
  },
  totals: {
    USD: "80.81",
    EUR: "69.98",
    GBP: "69.987964",
    RUB: "8552.283886",
    TRY: "4593.496595",
  },
};

test("parseOpsAmount accepts 100, 100.00 and 100,00 style inputs", () => {
  assert.equal(parseOpsAmount("100"), 100);
  assert.equal(parseOpsAmount("100.00"), 100);
  assert.equal(parseOpsAmount("100,00"), 100);
  assert.equal(parseOpsAmount("1.100,00"), 1100);
  assert.equal(parseOpsAmount("1,100.00"), 1100);
  assert.equal(parseOpsAmount("8552.283886"), 8552.283886);
});

test("ops amounts use 2 decimals and locale separators without currency", () => {
  assert.equal(formatOpsAmount("80.81", "tr"), "80,81");
  assert.equal(formatOpsAmount("4256.70", "tr"), "4.256,70");
  assert.equal(formatOpsAmount("8552.283886", "tr"), "8.552,28");
  assert.equal(formatOpsAmount("69.987964", "tr"), "69,99");
  assert.equal(formatOpsAmount("80.81", "en"), "80.81");
  assert.equal(formatOpsAmount("4256.70", "en"), "4,256.70");
  const ru = formatOpsAmount("4256.70", "ru");
  assert.equal(ru.includes("256"), true);
  assert.equal(ru.includes("70"), true);
  assert.equal(ru.includes("4256.703"), false);
});

test("selected price prefers applied vehicle total over stale snapshot totals", () => {
  const tryPrice = selectedStoredAmount({
    currency: "TRY",
    appliedVehicleTotal: "38528.35",
    fxSnapshot: snapshot,
  });
  assert.equal(tryPrice.amount, "38528.35");
  assert.equal(formatOpsSelectedPrice(tryPrice.amount, tryPrice.currency, "tr"), "38.528,35 ₺");

  const usd = selectedStoredAmount({
    currency: "USD",
    appliedVehicleTotal: "80.81",
    fxSnapshot: snapshot,
  });
  assert.equal(usd.amount, "80.81");
  assert.equal(formatOpsSelectedPrice(usd.amount, usd.currency, "tr"), "80,81 $");
});

test("other currencies come from the stored snapshot when vehicle EUR matches", () => {
  const others = otherStoredAmounts({
    currency: "USD",
    appliedVehicleTotalEur: "69.98",
    fxSnapshot: snapshot,
  });
  assert.deepEqual(
    others.map((item) => item.code),
    ["EUR", "TRY", "RUB", "GBP"],
  );
  const formatted = others.map((item) => formatOpsOtherPrice(item.amount, item.code, "tr"));
  assert.equal(formatted.includes("80,81 $"), false);
  assert.equal(formatted.includes("69,98 €"), true);
  assert.equal(formatted.includes("8.552,28 ₽"), true);
  assert.equal(formatted.includes("4.593,50 ₺"), true);
  assert.equal(formatted.includes("69,99 £"), true);
});

test("other currencies use snapshot rates with selected vehicle EUR when snapshot is stale", () => {
  const others = otherStoredAmounts({
    currency: "TRY",
    appliedVehicleTotalEur: "139.96",
    fxSnapshot: snapshot,
  });
  const eur = others.find((item) => item.code === "EUR");
  assert.equal(eur?.amount, "139.96");
});

test("quote snapshot is used only when no selected vehicle total exists", () => {
  const quoteUsd = selectedStoredAmount({
    currency: "USD",
    appliedVehicleTotal: null,
    fxSnapshot: snapshot,
  });
  assert.equal(quoteUsd.amount, snapshot.totals.USD);
  const quoteEur = selectedStoredAmount({
    currency: "EUR",
    appliedVehicleTotal: null,
    fxSnapshot: snapshot,
  });
  assert.equal(quoteEur.amount, snapshot.totals.EUR);
  const selected = selectedStoredAmount({
    currency: "USD",
    appliedVehicleTotal: "112.81",
    fxSnapshot: snapshot,
  });
  assert.equal(selected.amount, "112.81");
  assert.notEqual(selected.amount, snapshot.totals.USD);
});

test("falls back to applied vehicle total when snapshot has no selected currency", () => {
  const result = selectedStoredAmount({
    currency: "GBP",
    appliedVehicleTotal: "69.99",
    fxSnapshot: null,
  });
  assert.equal(result.amount, "69.99");
  assert.equal(formatOpsAmount(result.amount, "tr"), "69,99");
});
