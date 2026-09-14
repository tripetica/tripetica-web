import {
  convertEurTotal,
  parseFxSnapshot,
  snapshotMatchesTotal,
} from "@/lib/booking/fx/convert";
import { type FxSnapshot } from "@/lib/booking/fx/types";
import {
  CURRENCY_SYMBOLS,
  DISPLAY_CURRENCIES,
  isDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import { type Locale } from "@/lib/i18n/config";
import { manualOtherAmounts, type ManualPriceTotals } from "@/lib/ops/price-override";

function numberLocale(locale: Locale) {
  if (locale === "ru") {
    return "ru-RU";
  }
  if (locale === "tr") {
    return "tr-TR";
  }
  return "en-GB";
}

export function parseOpsAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = value.trim();
  if (!text || text === "null" || text === "undefined") {
    return null;
  }
  const compact = text.replace(/\s/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const fraction = compact.length - lastComma - 1;
    normalized =
      fraction === 3 ? compact.replace(/,/g, "") : compact.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatOpsAmount(
  value: string | number | null | undefined,
  locale: Locale,
): string {
  const n = parseOpsAmount(value);
  if (n === null) {
    return "";
  }
  return new Intl.NumberFormat(numberLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
}

export function formatOpsAmountOrDash(
  value: string | number | null | undefined,
  locale: Locale,
) {
  return formatOpsAmount(value, locale) || "—";
}

export function opsCurrencySymbol(code: string | null | undefined) {
  const trimmed = code?.trim();
  if (trimmed && isDisplayCurrency(trimmed)) {
    return CURRENCY_SYMBOLS[trimmed];
  }
  return "";
}

export function formatOpsSelectedPrice(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
  locale: Locale,
) {
  const formatted = formatOpsAmount(amount, locale);
  if (!formatted) {
    return "";
  }
  const symbol = opsCurrencySymbol(currency);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function formatOpsOtherPrice(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
  locale: Locale,
) {
  const formatted = formatOpsAmount(amount, locale);
  if (!formatted) {
    return "";
  }
  const symbol = opsCurrencySymbol(currency) || currency?.trim() || "";
  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function snapshotCurrencyTotals(
  snapshot: unknown,
): Partial<Record<DisplayCurrency, string>> {
  const parsed = parseFxSnapshot(snapshot);
  if (!parsed) {
    return {};
  }
  const totals: Partial<Record<DisplayCurrency, string>> = {};
  for (const code of DISPLAY_CURRENCIES) {
    const precise = parsed.totals[code];
    if (precise != null && String(precise).trim() !== "") {
      totals[code] = String(precise);
    }
  }
  return totals;
}

function totalsFromSnapshotRates(
  totalEur: string,
  snapshot: FxSnapshot,
): Partial<Record<DisplayCurrency, string>> {
  const totals: Partial<Record<DisplayCurrency, string>> = {};
  for (const code of DISPLAY_CURRENCIES) {
    const quote = snapshot.rates[code];
    if (!quote) {
      continue;
    }
    try {
      totals[code] = convertEurTotal(totalEur, quote).precise;
    } catch {
      const fallback = snapshot.totals[code];
      if (fallback != null && String(fallback).trim() !== "") {
        totals[code] = String(fallback);
      }
    }
  }
  return totals;
}

export function canonicalFxSnapshot(
  fxSnapshot: unknown,
  appliedVehicleTotalEur: string | number | null | undefined,
): unknown {
  const parsed = parseFxSnapshot(fxSnapshot);
  const vehicleEur = parseOpsAmount(appliedVehicleTotalEur);
  if (!parsed || vehicleEur === null) {
    return fxSnapshot;
  }
  if (snapshotMatchesTotal(parsed, vehicleEur)) {
    return fxSnapshot;
  }
  const totalEur = String(appliedVehicleTotalEur);
  return {
    ...parsed,
    totalEur,
    totals: {
      ...parsed.totals,
      ...totalsFromSnapshotRates(totalEur, parsed),
    },
  };
}

export function selectedStoredAmount(input: {
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
  const totals = snapshotCurrencyTotals(input.fxSnapshot);
  const fromSnapshot =
    currency && isDisplayCurrency(currency) ? totals[currency] : undefined;
  if (fromSnapshot) {
    return { currency, amount: fromSnapshot };
  }
  return { currency, amount: null };
}

export function otherStoredAmounts(input: {
  currency: string | null | undefined;
  appliedVehicleTotalEur?: string | number | null;
  fxSnapshot?: unknown;
  priceManuallyOverridden?: boolean;
  manualPriceTotals?: ManualPriceTotals | null;
}): Array<{ code: DisplayCurrency; amount: string }> {
  if (input.priceManuallyOverridden && input.manualPriceTotals) {
    return manualOtherAmounts({
      currency: input.currency,
      manualPriceTotals: input.manualPriceTotals,
    });
  }
  const selected = input.currency?.trim();
  const snapshot = parseFxSnapshot(input.fxSnapshot);
  if (!snapshot) {
    return [];
  }

  const vehicleEur = parseOpsAmount(input.appliedVehicleTotalEur);
  const totals =
    vehicleEur !== null && !snapshotMatchesTotal(snapshot, vehicleEur)
      ? totalsFromSnapshotRates(String(input.appliedVehicleTotalEur), snapshot)
      : snapshotCurrencyTotals(snapshot);

  const rows: Array<{ code: DisplayCurrency; amount: string }> = [];
  for (const code of DISPLAY_CURRENCIES) {
    if (code === selected) {
      continue;
    }
    const amount = totals[code];
    if (amount) {
      rows.push({ code, amount });
    }
  }
  return rows;
}
