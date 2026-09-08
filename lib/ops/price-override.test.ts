import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCalculatedPriceTotals,
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
