import { type DisplayCurrency } from "@/lib/booking/pricing/format-eur";

export const FX_BASE_CURRENCY = "EUR" as const;
export const FX_SOURCE = "exchange-rate-api-open-access" as const;
export const FX_CACHE_TTL_SECONDS = 86400;
/** Wait this long after provider `time_next_update` before Tripetica fetches. */
export const FX_PROVIDER_FETCH_BUFFER_MS = 15 * 60 * 1000;
/** Minimum wait between failed scheduled fetch attempts. */
export const FX_SCHEDULED_RETRY_MS = 10 * 60 * 1000;
export const RUB_MARGIN_PER_EUR = 6;

export type FxQuoteCurrency = DisplayCurrency;
export type FxSource = typeof FX_SOURCE;

export type FxEurBaseRates = {
  USD: number;
  EUR: number;
  TRY: number;
  RUB: number;
  GBP: number;
};

export type FxRawRates = FxEurBaseRates & {
  base: "EUR";
  timeLastUpdateUnix?: number;
  /** Original ExchangeRate-API `time_next_update_utc` string when present. */
  timeNextUpdateUtc?: string;
};

export type FxRateQuote = {
  quoteCurrency: FxQuoteCurrency;
  rate: string;
  source: string;
  fetchedAt: string;
  expiresAt?: string;
  marketEurToRub?: string;
};

export type FxBook = Partial<Record<FxQuoteCurrency, FxRateQuote>>;

export type FxQuoteCacheRecord = {
  source: typeof FX_SOURCE;
  fetchedAt: string;
  expiresAt: string;
  /** Provider `time_next_update_utc` as ISO timestamptz; not Tripetica cache TTL. */
  providerNextUpdateAt: string | null;
  USD: string;
  EUR: string;
  TRY: string;
  RUB: string;
  GBP: string;
  marketEurToRub: string;
  rawRates: FxRawRates;
};

export type FxSnapshotRate = FxRateQuote & {
  unavailable?: boolean;
};

export type FxSnapshotTotals = Record<FxQuoteCurrency, string | null>;

export type FxSnapshot = {
  baseCurrency: typeof FX_BASE_CURRENCY;
  totalEur: string;
  capturedAt: string;
  rates: Partial<Record<FxQuoteCurrency, FxSnapshotRate>>;
  totals: FxSnapshotTotals;
};

export type FxFetchErrorCode =
  | "http_error"
  | "timeout"
  | "invalid_json"
  | "invalid_result"
  | "invalid_base"
  | "missing_rate"
  | "missing_next_update"
  | "invalid_rate"
  | "empty_body"
  | "save_failed"
  | "load_failed";
