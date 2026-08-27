import {
  convertMicroEur,
  displayAmountFromMicro,
  isPlausibleQuoteRate,
  microAmountToPreciseString,
  microEurAmount,
  parsePositiveRate,
} from "@/lib/booking/fx/decimal-rate";
import { FX_SOURCE, type FxBook, type FxQuoteCacheRecord, type FxRateQuote, type FxSnapshot, type FxSnapshotTotals } from "@/lib/booking/fx/types";
import {
  DISPLAY_CURRENCIES,
  type CurrencyTotalView,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";

export function bookFromQuoteCache(record: FxQuoteCacheRecord): FxBook {
  const meta = {
    source: record.source,
    fetchedAt: record.fetchedAt,
    expiresAt: record.expiresAt,
  };
  return {
    USD: { quoteCurrency: "USD", rate: record.USD, ...meta },
    EUR: { quoteCurrency: "EUR", rate: record.EUR, ...meta },
    TRY: { quoteCurrency: "TRY", rate: record.TRY, ...meta },
    RUB: {
      quoteCurrency: "RUB",
      rate: record.RUB,
      marketEurToRub: record.marketEurToRub,
      ...meta,
    },
    GBP: { quoteCurrency: "GBP", rate: record.GBP, ...meta },
  };
}

export function fxBookFromEurRates(
  rates: Partial<Record<keyof FxBook, string>>,
  fetchedAt = "2026-08-25T00:00:00.000Z",
): FxBook {
  const book: FxBook = {};
  for (const code of DISPLAY_CURRENCIES) {
    const rate = code === "EUR" ? rates.EUR ?? "1" : rates[code];
    if (!rate) {
      continue;
    }
    const quote: FxRateQuote = {
      quoteCurrency: code,
      rate,
      source: FX_SOURCE,
      fetchedAt,
    };
    if (validQuote(quote)) {
      book[code] = quote;
    }
  }
  return book;
}

export function validQuote(row: FxRateQuote): boolean {
  try {
    const scaled = parsePositiveRate(row.rate);
    return isPlausibleQuoteRate(row.quoteCurrency, scaled);
  } catch {
    return false;
  }
}

export function convertEurTotal(
  totalEur: string | number,
  quote: FxRateQuote,
): { precise: string; display: number } {
  const micro = convertMicroEur(
    microEurAmount(totalEur),
    parsePositiveRate(quote.rate),
  );
  return {
    precise: microAmountToPreciseString(micro),
    display: displayAmountFromMicro(micro, quote.quoteCurrency),
  };
}

export function buildFxSnapshot(
  totalEur: string | number,
  book: FxBook,
  capturedAt = new Date().toISOString(),
): FxSnapshot {
  const total = microAmountToPreciseString(microEurAmount(totalEur));
  const totals = {} as FxSnapshotTotals;
  const rates: FxSnapshot["rates"] = {};

  for (const code of DISPLAY_CURRENCIES) {
    const quote = book[code];
    if (!quote || !validQuote(quote)) {
      totals[code] = null;
      continue;
    }
    const converted = convertEurTotal(total, quote);
    totals[code] = converted.precise;
    rates[code] = quote;
  }

  if (totals.EUR === null) {
    totals.EUR = total;
    rates.EUR = {
      quoteCurrency: "EUR",
      rate: "1",
      source: FX_SOURCE,
      fetchedAt: capturedAt,
    };
  }

  return {
    baseCurrency: "EUR",
    totalEur: total,
    capturedAt,
    rates,
    totals,
  };
}

export function currencyTotalsFromSnapshot(
  snapshot: FxSnapshot | null | undefined,
): CurrencyTotalView[] {
  return DISPLAY_CURRENCIES.map((code) => {
    const precise = snapshot?.totals[code] ?? null;
    if (precise === null) {
      return { code, amount: null };
    }
    const quote = snapshot?.rates[code];
    const display = quote
      ? convertEurTotal(snapshot!.totalEur, quote).display
      : displayAmountFromMicro(microEurAmount(precise), code);
    return { code, amount: display };
  });
}

export function currencyTotalsFromBook(
  totalEur: number,
  book: FxBook,
): CurrencyTotalView[] {
  return currencyTotalsFromSnapshot(buildFxSnapshot(totalEur, book));
}

export function displayAmountFromEur(
  amountEur: number,
  code: DisplayCurrency,
  rates: Partial<Record<DisplayCurrency, FxRateQuote>> | null | undefined,
): number | null {
  const quote = rates?.[code];
  if (quote && validQuote(quote)) {
    try {
      return convertEurTotal(amountEur, quote).display;
    } catch {
      return null;
    }
  }
  if (code !== "EUR") {
    return null;
  }
  try {
    return displayAmountFromMicro(microEurAmount(amountEur), "EUR");
  } catch {
    return null;
  }
}

export function snapshotMatchesTotal(
  snapshot: FxSnapshot | null | undefined,
  totalEur: number,
): boolean {
  if (!snapshot) {
    return false;
  }
  try {
    return microEurAmount(snapshot.totalEur) === microEurAmount(totalEur);
  } catch {
    return false;
  }
}

export function parseFxSnapshot(value: unknown): FxSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Partial<FxSnapshot>;
  if (raw.baseCurrency !== "EUR" || typeof raw.totalEur !== "string") {
    return null;
  }
  if (!raw.totals || typeof raw.totals !== "object") {
    return null;
  }
  return raw as FxSnapshot;
}
