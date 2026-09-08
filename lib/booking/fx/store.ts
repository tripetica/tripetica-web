import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import { FX_SOURCE, type FxQuoteCacheRecord } from "@/lib/booking/fx/types";
import { isPlausibleQuoteRate, parsePositiveRate } from "@/lib/booking/fx/decimal-rate";

type FxQuoteCacheRow = {
  source: string;
  fetched_at: Date;
  expires_at: Date;
  provider_next_update_at: Date | null;
  eur_to_usd: string;
  eur_to_eur: string;
  eur_to_try: string;
  market_eur_to_rub: string;
  eur_to_rub: string;
  eur_to_gbp: string;
  raw_rates: unknown;
};

function numericString(value: unknown): string {
  return String(value);
}

function parseRawRates(value: unknown): FxQuoteCacheRecord["rawRates"] | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const usd = Number(raw.USD);
  const eur = Number(raw.EUR);
  const tryRate = Number(raw.TRY);
  const rub = Number(raw.RUB);
  const gbp = Number(raw.GBP);
  if (
    ![usd, eur, tryRate, rub, gbp].every(
      (amount) => Number.isFinite(amount) && amount > 0,
    )
  ) {
    return null;
  }
  if (eur < 0.999 || eur > 1.001) {
    return null;
  }
  const parsed: FxQuoteCacheRecord["rawRates"] = {
    base: "EUR",
    USD: usd,
    EUR: 1,
    TRY: tryRate,
    RUB: rub,
    GBP: gbp,
  };
  if (
    typeof raw.timeLastUpdateUnix === "number" &&
    Number.isFinite(raw.timeLastUpdateUnix)
  ) {
    parsed.timeLastUpdateUnix = raw.timeLastUpdateUnix;
  }
  if (typeof raw.timeNextUpdateUtc === "string" && raw.timeNextUpdateUtc.trim()) {
    parsed.timeNextUpdateUtc = raw.timeNextUpdateUtc.trim();
  }
  return parsed;
}

function mapRow(row: FxQuoteCacheRow): FxQuoteCacheRecord | null {
  if (row.source !== FX_SOURCE) {
    return null;
  }
  const fetchedAt = row.fetched_at.toISOString();
  const expiresAt = row.expires_at.toISOString();
  const providerNextUpdateAt = row.provider_next_update_at
    ? row.provider_next_update_at.toISOString()
    : null;
  const rawRates = parseRawRates(row.raw_rates);
  if (
    !rawRates ||
    !Number.isFinite(Date.parse(fetchedAt)) ||
    !Number.isFinite(Date.parse(expiresAt))
  ) {
    return null;
  }
  if (
    providerNextUpdateAt &&
    !Number.isFinite(Date.parse(providerNextUpdateAt))
  ) {
    return null;
  }
  const record: FxQuoteCacheRecord = {
    source: FX_SOURCE,
    fetchedAt,
    expiresAt,
    providerNextUpdateAt,
    USD: numericString(row.eur_to_usd),
    EUR: numericString(row.eur_to_eur),
    TRY: numericString(row.eur_to_try),
    RUB: numericString(row.eur_to_rub),
    GBP: numericString(row.eur_to_gbp),
    marketEurToRub: numericString(row.market_eur_to_rub),
    rawRates,
  };
  const quotes = {
    USD: record.USD,
    EUR: record.EUR,
    TRY: record.TRY,
    RUB: record.RUB,
    GBP: record.GBP,
  } as const;
  for (const code of ["USD", "EUR", "TRY", "RUB", "GBP"] as const) {
    try {
      if (!isPlausibleQuoteRate(code, parsePositiveRate(quotes[code]))) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return record;
}

export async function loadActiveQuoteCache(): Promise<FxQuoteCacheRecord | null> {
  try {
    const result = await query<FxQuoteCacheRow>(
      `SELECT source, fetched_at, expires_at, provider_next_update_at,
              eur_to_usd, eur_to_eur, eur_to_try,
              market_eur_to_rub, eur_to_rub, eur_to_gbp,
              raw_rates
       FROM fx_quote_cache
       WHERE is_active = TRUE
       ORDER BY fetched_at DESC
       LIMIT 1`,
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  } catch (error) {
    console.error("[Tripetica fx] load active ExchangeRate-API cache failed");
    console.error(error);
    return null;
  }
}

export async function saveQuoteCache(record: FxQuoteCacheRecord) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE fx_quote_cache
       SET is_active = FALSE
       WHERE is_active = TRUE`,
    );
    await client.query(
      `INSERT INTO fx_quote_cache (
         source, fetched_at, expires_at, provider_next_update_at,
         eur_to_usd, eur_to_eur, eur_to_try,
         market_eur_to_rub, eur_to_rub, eur_to_gbp,
         raw_rates, is_active
       ) VALUES (
         $1, $2::timestamptz, $3::timestamptz, $4::timestamptz,
         $5::numeric, $6::numeric, $7::numeric,
         $8::numeric, $9::numeric, $10::numeric,
         $11::jsonb, TRUE
       )`,
      [
        FX_SOURCE,
        record.fetchedAt,
        record.expiresAt,
        record.providerNextUpdateAt,
        record.USD,
        record.EUR,
        record.TRY,
        record.marketEurToRub,
        record.RUB,
        record.GBP,
        JSON.stringify(record.rawRates),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function logFxFetchAttempt(input: {
  status: "ok" | "error";
  errorCode?: string | null;
}) {
  try {
    await query(
      `INSERT INTO fx_rate_fetch_attempts (source, quote_currency, status, error_code)
       VALUES ($1, NULL, $2, $3)`,
      [FX_SOURCE, input.status, input.errorCode ?? null],
    );
  } catch (error) {
    console.error("[Tripetica fx] fetch log failed");
    console.error(error);
  }
}

export async function loadLatestFxFetchAttempt(): Promise<{
  status: "ok" | "error";
  errorCode: string | null;
  fetchedAt: string;
} | null> {
  try {
    const result = await query<{
      status: string;
      error_code: string | null;
      fetched_at: Date;
    }>(
      `SELECT status, error_code, fetched_at
       FROM fx_rate_fetch_attempts
       WHERE source = $1
       ORDER BY fetched_at DESC
       LIMIT 1`,
      [FX_SOURCE],
    );
    const row = result.rows[0];
    if (!row || (row.status !== "ok" && row.status !== "error")) {
      return null;
    }
    return {
      status: row.status,
      errorCode: row.error_code,
      fetchedAt: row.fetched_at.toISOString(),
    };
  } catch (error) {
    console.error("[Tripetica fx] load latest fetch attempt failed");
    console.error(error);
    return null;
  }
}
