import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCalculatedPriceTotals,
  buildPriceEditApplyTotals,
  normalizeManualAmount,
  recalcManualTotalsFromCurrency,
  resolveStoredPriceAmount,
  validateManualPriceTotals,
} from "@/lib/ops/price-override";

const snapshot = {
  baseCurrency: "EUR" as const,
  totalEur: "100",
  capturedAt: "2026-08-28T10:00:00.000Z",
  rates: {
    USD: {
      quoteCurrency: "USD" as const,
      rate: "1.1",
      source: "test",
      fetchedAt: "2026-08-28T10:00:00.000Z",
    },
    EUR: {
      quoteCurrency: "EUR" as const,
      rate: "1",
      source: "test",
      fetchedAt: "2026-08-28T10:00:00.000Z",
    },
    TRY: {
      quoteCurrency: "TRY" as const,
      rate: "40",
      source: "test",
      fetchedAt: "2026-08-28T10:00:00.000Z",
    },
    RUB: {
      quoteCurrency: "RUB" as const,
      rate: "100",
      source: "test",
      fetchedAt: "2026-08-28T10:00:00.000Z",
    },
    GBP: {
      quoteCurrency: "GBP" as const,
      rate: "0.85",
      source: "test",
      fetchedAt: "2026-08-28T10:00:00.000Z",
    },
  },
  totals: {
    USD: "110.00",
    EUR: "100.00",
    TRY: "4000.00",
    RUB: "10000.00",
    GBP: "85.00",
  },
};

test("manual override is preferred for display and completion price", () => {
  const result = resolveStoredPriceAmount({
    currency: "USD",
    appliedVehicleTotal: "105",
    fxSnapshot: snapshot,
    priceManuallyOverridden: true,
    manualPriceTotals: { USD: "100.00", EUR: "97.00" },
  });
  assert.equal(result.amount, "100.00");
  assert.equal(result.currency, "USD");
});

test("validateManualPriceTotals rejects negative values", () => {
  assert.equal(validateManualPriceTotals({ USD: "-1" }), null);
  assert.deepEqual(validateManualPriceTotals({ USD: "100" }), { USD: "100.00" });
});

test("ops override 104.75 EUR to 100 EUR stays authoritative for save and conversion", () => {
  const calculated = resolveStoredPriceAmount({
    currency: "EUR",
    appliedVehicleTotal: "104.75",
    fxSnapshot: snapshot,
  });
  assert.equal(calculated.amount, "104.75");

  const overridden = resolveStoredPriceAmount({
    currency: "EUR",
    appliedVehicleTotal: "104.75",
    fxSnapshot: snapshot,
    priceManuallyOverridden: true,
    manualPriceTotals: { EUR: "100.00", USD: "110.00", TRY: "4000.00", RUB: "10000.00", GBP: "85.00" },
  });
  assert.equal(overridden.amount, "100.00");
  assert.equal(overridden.currency, "EUR");
  assert.notEqual(overridden.amount, calculated.amount);
});

test("without an ops override, stored calculated pricing is unchanged", () => {
  const result = resolveStoredPriceAmount({
    currency: "EUR",
    appliedVehicleTotal: "104.75",
    fxSnapshot: snapshot,
    priceManuallyOverridden: false,
    manualPriceTotals: { EUR: "100.00" },
  });
  assert.equal(result.amount, "104.75");
});

test("validateManualPriceTotals keeps a valid selected currency when another amount is junk", () => {
  const totals = validateManualPriceTotals({
    EUR: "100,00",
    USD: "not-a-price",
    TRY: "4000.00",
  });
  assert.ok(totals);
  assert.equal(totals?.EUR, "100.00");
  assert.equal(totals?.TRY, "4000.00");
  assert.equal(totals?.USD, undefined);
});

test("EUR override recalculates USD TRY RUB GBP from the stored snapshot", () => {
  const next = recalcManualTotalsFromCurrency("EUR", "100", snapshot, {
    EUR: "104.75",
    USD: "115.23",
    TRY: "4190.00",
    RUB: "10475.00",
    GBP: "89.04",
  });
  assert.ok(next);
  assert.equal(next?.EUR, "100.00");
  assert.equal(next?.USD, "110.00");
  assert.equal(next?.TRY, "4000.00");
  assert.equal(next?.RUB, "10000.00");
  assert.equal(next?.GBP, "85.00");
});

test("recalc uses stored snapshot rates without touching source currency", () => {
  const next = recalcManualTotalsFromCurrency(
    "USD",
    "100",
    snapshot,
    { USD: "100", EUR: "97", TRY: "4600", RUB: "9500", GBP: "82" },
  );
  assert.ok(next);
  assert.equal(next?.USD, "100.00");
  assert.equal(next?.EUR, "90.91");
  assert.equal(next?.TRY, "3636.36");
});

test("buildCalculatedPriceTotals prefers applied vehicle total in selected currency", () => {
  const totals = buildCalculatedPriceTotals({
    currency: "USD",
    appliedVehicleTotal: "105",
    fxSnapshot: snapshot,
  });
  assert.equal(totals.USD, "105.00");
  assert.equal(normalizeManualAmount("105"), "105.00");
});

test("price modal local save still applies the edited currency and FX counterparts", () => {
  const applied = buildPriceEditApplyTotals({
    lastEditedCurrency: "EUR",
    draftTotals: {
      EUR: "100",
      USD: "115.23",
      TRY: "4190.00",
      RUB: "10475.00",
      GBP: "89.04",
    },
    fxSnapshot: snapshot,
  });
  assert.equal(applied.EUR, "100.00");
  assert.equal(applied.USD, "110.00");
  assert.equal(applied.TRY, "4000.00");
  assert.equal(applied.RUB, "10000.00");
  assert.equal(applied.GBP, "85.00");
});
