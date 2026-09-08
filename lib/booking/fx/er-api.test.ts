import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRubMargin,
  eurQuoteRatesFromApi,
  parseErApiLatestPayload,
  quoteCacheFromErApiPayload,
} from "./er-api";
import { convertEurTotal, fxBookFromEurRates } from "./convert";
import { FX_CACHE_TTL_SECONDS, FX_SOURCE } from "./types";

const SAMPLE_ER = {
  result: "success",
  provider: "https://www.exchangerate-api.com",
  base_code: "EUR",
  time_last_update_unix: 1756080000,
  time_next_update_utc: "Tue, 26 Aug 2025 00:00:01 +0000",
  rates: {
    EUR: 1,
    USD: 1.2,
    TRY: 40,
    RUB: 97,
    GBP: 0.85,
    CAD: 1.5,
  },
};

test("EUR-base ExchangeRate-API rates are used without USD conversion", () => {
  const parsed = parseErApiLatestPayload(SAMPLE_ER);
  assert.equal(parsed.rates.EUR, 1);
  assert.equal(parsed.rates.USD, 1.2);
  const quotes = eurQuoteRatesFromApi(parsed.rates);
  assert.equal(quotes.EUR_TO_USD, "1.2");
  assert.equal(quotes.EUR_TO_TRY, "40");
  assert.equal(quotes.MARKET_EUR_TO_RUB, "97");
  assert.equal(quotes.EUR_TO_RUB, "103");
  assert.equal(quotes.EUR_TO_GBP, "0.85");
  assert.equal(quotes.EUR_TO_EUR, "1");
});

test("RUB margin is +6 per EUR, then multiplied by the EUR total", () => {
  assert.equal(applyRubMargin("97"), "103");
  const book = fxBookFromEurRates({ RUB: "103" });
  const converted = convertEurTotal(40, book.RUB!);
  assert.equal(converted.precise, "4120");
  assert.equal(converted.display, 4120);
  assert.notEqual(converted.display, 40 * 97 + 6);
});

test("invalid or incomplete ExchangeRate-API payloads are rejected", () => {
  assert.throws(
    () => parseErApiLatestPayload({ ...SAMPLE_ER, result: "error" }),
    /invalid_result/,
  );
  assert.throws(
    () => parseErApiLatestPayload({ ...SAMPLE_ER, base_code: "USD" }),
    /invalid_base/,
  );
  assert.throws(
    () => parseErApiLatestPayload({ result: "success", base_code: "EUR", rates: { USD: 1.2 } }),
    /missing_rate/,
  );
  assert.throws(
    () =>
      parseErApiLatestPayload({
        ...SAMPLE_ER,
        rates: { ...SAMPLE_ER.rates, RUB: 0 },
      }),
    /missing_rate/,
  );
  assert.throws(
    () =>
      parseErApiLatestPayload({
        ...SAMPLE_ER,
        time_next_update_utc: undefined,
      }),
    /missing_next_update/,
  );
  assert.throws(
    () =>
      parseErApiLatestPayload({
        ...SAMPLE_ER,
        time_next_update_utc: "not-a-date",
      }),
    /missing_next_update/,
  );
  assert.throws(
    () => quoteCacheFromErApiPayload({ ...SAMPLE_ER, result: "error" }, Date.now()),
    /invalid_result/,
  );
});

test("quote cache record keeps EUR-base source, 24h expiry and raw RUB", () => {
  const now = Date.parse("2026-08-25T00:00:00.000Z");
  const record = quoteCacheFromErApiPayload(SAMPLE_ER, now);
  assert.equal(record.source, FX_SOURCE);
  assert.equal(record.source, "exchange-rate-api-open-access");
  assert.equal(record.fetchedAt, "2026-08-25T00:00:00.000Z");
  assert.equal(record.expiresAt, "2026-08-26T00:00:00.000Z");
  assert.equal(record.providerNextUpdateAt, "2025-08-26T00:00:01.000Z");
  assert.equal(record.rawRates.timeNextUpdateUtc, SAMPLE_ER.time_next_update_utc);
  assert.equal(FX_CACHE_TTL_SECONDS, 86400);
  assert.equal(record.rawRates.base, "EUR");
  assert.equal(record.rawRates.RUB, 97);
  assert.equal(record.USD, "1.2");
  assert.equal(record.TRY, "40");
  assert.equal(record.GBP, "0.85");
  assert.equal(record.marketEurToRub, "97");
  assert.equal(record.RUB, "103");
});
