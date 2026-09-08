import {
  isPlausibleQuoteRate,
  parsePositiveRate,
  rateScaledToString,
} from "@/lib/booking/fx/decimal-rate";
import {
  FX_CACHE_TTL_SECONDS,
  FX_SOURCE,
  RUB_MARGIN_PER_EUR,
  type FxEurBaseRates,
  type FxQuoteCacheRecord,
  type FxRawRates,
} from "@/lib/booking/fx/types";

export type EurQuoteRates = {
  EUR_TO_USD: string;
  EUR_TO_EUR: "1";
  EUR_TO_TRY: string;
  MARKET_EUR_TO_RUB: string;
  EUR_TO_RUB: string;
  EUR_TO_GBP: string;
};

function readPositiveNumber(value: unknown, code: string): number {
  const amount = typeof value === "string" ? Number(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`missing_rate:${code}`);
  }
  return amount;
}

export function applyRubMargin(marketEurToRub: string | number): string {
  const market = parsePositiveRate(marketEurToRub);
  return rateScaledToString(market + parsePositiveRate(RUB_MARGIN_PER_EUR));
}

export function eurQuoteRatesFromApi(rates: FxEurBaseRates): EurQuoteRates {
  const usd = rateScaledToString(parsePositiveRate(rates.USD));
  const tryRate = rateScaledToString(parsePositiveRate(rates.TRY));
  const marketRub = rateScaledToString(parsePositiveRate(rates.RUB));
  const gbp = rateScaledToString(parsePositiveRate(rates.GBP));
  return {
    EUR_TO_USD: usd,
    EUR_TO_EUR: "1",
    EUR_TO_TRY: tryRate,
    MARKET_EUR_TO_RUB: marketRub,
    EUR_TO_RUB: applyRubMargin(marketRub),
    EUR_TO_GBP: gbp,
  };
}

/** Parse ExchangeRate-API `time_next_update_utc` into an ISO timestamptz string. */
export function parseTimeNextUpdateUtc(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const ms = Date.parse(value.trim());
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

export function parseErApiLatestPayload(payload: unknown): {
  timeLastUpdateUnix: number | null;
  timeNextUpdateUtc: string;
  providerNextUpdateAt: string;
  rates: FxEurBaseRates;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid_json");
  }
  const raw = payload as Record<string, unknown>;
  if (raw.result !== "success") {
    throw new Error("invalid_result");
  }
  if (raw.base_code !== "EUR") {
    throw new Error("invalid_base");
  }
  const rates = raw.rates;
  if (!rates || typeof rates !== "object") {
    throw new Error("missing_rate");
  }
  const table = rates as Record<string, unknown>;
  const eur = readPositiveNumber(table.EUR, "EUR");
  const usd = readPositiveNumber(table.USD, "USD");
  const tryRate = readPositiveNumber(table.TRY, "TRY");
  const rub = readPositiveNumber(table.RUB, "RUB");
  const gbp = readPositiveNumber(table.GBP, "GBP");
  if (eur < 0.999 || eur > 1.001) {
    throw new Error("invalid_rate");
  }
  if (typeof raw.time_next_update_utc !== "string") {
    throw new Error("missing_next_update");
  }
  const timeNextUpdateUtc = raw.time_next_update_utc.trim();
  const providerNextUpdateAt = parseTimeNextUpdateUtc(timeNextUpdateUtc);
  if (!providerNextUpdateAt) {
    throw new Error("missing_next_update");
  }
  const timeLastUpdateUnix =
    typeof raw.time_last_update_unix === "number" &&
    Number.isFinite(raw.time_last_update_unix)
      ? raw.time_last_update_unix
      : null;
  return {
    timeLastUpdateUnix,
    timeNextUpdateUtc,
    providerNextUpdateAt,
    rates: { USD: usd, EUR: 1, TRY: tryRate, RUB: rub, GBP: gbp },
  };
}

export function quoteCacheFromErApiPayload(
  payload: unknown,
  nowMs: number,
): FxQuoteCacheRecord {
  if (!Number.isFinite(nowMs) || nowMs <= 0) {
    throw new Error("invalid_rate");
  }
  const parsed = parseErApiLatestPayload(payload);
  const quotes = eurQuoteRatesFromApi(parsed.rates);
  const eurBased = {
    USD: quotes.EUR_TO_USD,
    EUR: quotes.EUR_TO_EUR,
    TRY: quotes.EUR_TO_TRY,
    RUB: quotes.EUR_TO_RUB,
    GBP: quotes.EUR_TO_GBP,
  } as const;
  for (const code of ["USD", "EUR", "TRY", "RUB", "GBP"] as const) {
    if (!isPlausibleQuoteRate(code, parsePositiveRate(eurBased[code]))) {
      throw new Error("invalid_rate");
    }
  }
  const fetchedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + FX_CACHE_TTL_SECONDS * 1000).toISOString();
  const rawRates: FxRawRates = {
    base: "EUR",
    USD: parsed.rates.USD,
    EUR: parsed.rates.EUR,
    TRY: parsed.rates.TRY,
    RUB: parsed.rates.RUB,
    GBP: parsed.rates.GBP,
    timeNextUpdateUtc: parsed.timeNextUpdateUtc,
  };
  if (parsed.timeLastUpdateUnix != null) {
    rawRates.timeLastUpdateUnix = parsed.timeLastUpdateUnix;
  }
  return {
    source: FX_SOURCE,
    fetchedAt,
    expiresAt,
    providerNextUpdateAt: parsed.providerNextUpdateAt,
    USD: quotes.EUR_TO_USD,
    EUR: quotes.EUR_TO_EUR,
    TRY: quotes.EUR_TO_TRY,
    RUB: quotes.EUR_TO_RUB,
    GBP: quotes.EUR_TO_GBP,
    marketEurToRub: quotes.MARKET_EUR_TO_RUB,
    rawRates,
  };
}
