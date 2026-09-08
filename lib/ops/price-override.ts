import {
  convertEurTotal,
  parseFxSnapshot,
} from "@/lib/booking/fx/convert";
import {
  microAmountToPreciseString,
  microEurAmount,
  parsePositiveRate,
  RATE_SCALE,
} from "@/lib/booking/fx/decimal-rate";
import { type FxSnapshot } from "@/lib/booking/fx/types";
import {
  DISPLAY_CURRENCIES,
  isDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import { parseOpsAmount } from "@/lib/ops/money";

export type ManualPriceTotals = Partial<Record<DisplayCurrency, string>>;

export function parseManualPriceTotals(value: unknown): ManualPriceTotals | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const totals: ManualPriceTotals = {};
  for (const code of DISPLAY_CURRENCIES) {
    const raw = (value as Record<string, unknown>)[code];
    if (raw == null) {
      continue;
    }
    const amount = normalizeManualAmount(String(raw));
    if (amount !== null) {
      totals[code] = amount;
    }
  }
  return Object.keys(totals).length > 0 ? totals : null;
}

export function normalizeManualAmount(value: string): string | null {
  const parsed = parseOpsAmount(value);
  if (parsed === null || parsed < 0) {
    return null;
  }
  return parsed.toFixed(2);
}

export function validateManualPriceTotals(
  totals: ManualPriceTotals,
): ManualPriceTotals | null {
  const normalized: ManualPriceTotals = {};
  for (const code of DISPLAY_CURRENCIES) {
    const raw = totals[code];
    if (raw == null || String(raw).trim() === "") {
      continue;
    }
    const amount = normalizeManualAmount(String(raw));
    if (amount === null) {
      return null;
    }
    normalized[code] = amount;
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function buildCalculatedPriceTotals(input: {
  currency: string | null | undefined;
  appliedVehicleTotal?: string | number | null;
  totalPrice?: string | number | null;
  appliedVehicleTotalEur?: string | number | null;
  fxSnapshot?: unknown;
}): ManualPriceTotals {
  const snapshot = parseFxSnapshot(input.fxSnapshot);
  const totals: ManualPriceTotals = {};
  if (snapshot) {
    for (const code of DISPLAY_CURRENCIES) {
      const precise = snapshot.totals[code];
      if (precise != null && String(precise).trim() !== "") {
        totals[code] = normalizeManualAmount(String(precise)) ?? String(precise);
      }
    }
  }
  const currency = input.currency?.trim();
  const primary =
    input.appliedVehicleTotal != null && String(input.appliedVehicleTotal).trim() !== ""
      ? String(input.appliedVehicleTotal)
      : input.totalPrice != null && String(input.totalPrice).trim() !== ""
        ? String(input.totalPrice)
        : null;
  if (currency && isDisplayCurrency(currency) && primary) {
    const normalized = normalizeManualAmount(primary);
    if (normalized) {
      totals[currency] = normalized;
    }
  }
  return totals;
}

export function resolveStoredPriceAmount(input: {
  currency: string | null | undefined;
  appliedVehicleTotal?: string | number | null;
  totalPrice?: string | number | null;
  fxSnapshot?: unknown;
  priceManuallyOverridden?: boolean;
  manualPriceTotals?: ManualPriceTotals | null;
}): { currency: string | null; amount: string | null } {
  const currency = input.currency?.trim() || null;
  if (
    input.priceManuallyOverridden &&
    input.manualPriceTotals &&
    currency &&
    isDisplayCurrency(currency)
  ) {
    const manual = input.manualPriceTotals[currency];
    if (manual != null && String(manual).trim() !== "") {
      return { currency, amount: String(manual) };
    }
  }
  if (input.totalPrice != null && String(input.totalPrice).trim() !== "") {
    return { currency, amount: String(input.totalPrice) };
  }
  if (input.appliedVehicleTotal != null && String(input.appliedVehicleTotal).trim() !== "") {
    return { currency, amount: String(input.appliedVehicleTotal) };
  }
  const snapshot = parseFxSnapshot(input.fxSnapshot);
  if (snapshot && currency && isDisplayCurrency(currency)) {
    const fromSnapshot = snapshot.totals[currency];
    if (fromSnapshot != null && String(fromSnapshot).trim() !== "") {
      return { currency, amount: String(fromSnapshot) };
    }
  }
  return { currency, amount: null };
}

export function manualOtherAmounts(input: {
  currency: string | null | undefined;
  manualPriceTotals: ManualPriceTotals;
}): Array<{ code: DisplayCurrency; amount: string }> {
  const selected = input.currency?.trim();
  const rows: Array<{ code: DisplayCurrency; amount: string }> = [];
  for (const code of DISPLAY_CURRENCIES) {
    if (code === selected) {
      continue;
    }
    const amount = input.manualPriceTotals[code];
    if (amount) {
      rows.push({ code, amount });
    }
  }
  return rows;
}

function amountToEur(amount: string, snapshot: FxSnapshot, currency: DisplayCurrency): string | null {
  if (currency === "EUR") {
    return normalizeManualAmount(amount);
  }
  const quote = snapshot.rates[currency];
  if (!quote) {
    return null;
  }
  try {
    const rate = parsePositiveRate(quote.rate);
    const quoteMicro = microEurAmount(amount);
    const eurMicro = (quoteMicro * RATE_SCALE) / rate;
    return microAmountToPreciseString(eurMicro);
  } catch {
    return null;
  }
}

export function recalcManualTotalsFromCurrency(
  sourceCurrency: DisplayCurrency,
  sourceAmount: string,
  fxSnapshot: unknown,
  currentTotals: ManualPriceTotals,
): ManualPriceTotals | null {
  const normalized = normalizeManualAmount(sourceAmount);
  if (!normalized) {
    return null;
  }
  const snapshot = parseFxSnapshot(fxSnapshot);
  if (!snapshot) {
    return null;
  }
  const totalEur = amountToEur(normalized, snapshot, sourceCurrency);
  if (!totalEur) {
    return null;
  }
  const next: ManualPriceTotals = { ...currentTotals, [sourceCurrency]: normalized };
  for (const code of DISPLAY_CURRENCIES) {
    if (code === sourceCurrency) {
      continue;
    }
    const quote = snapshot.rates[code];
    if (!quote) {
      continue;
    }
    try {
      const precise = convertEurTotal(totalEur, quote).precise;
      const normalized = normalizeManualAmount(precise);
      if (normalized) {
        next[code] = normalized;
      }
    } catch {
      // keep existing value when conversion fails
    }
  }
  return next;
}
