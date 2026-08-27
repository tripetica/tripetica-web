import assert from "node:assert/strict";
import { test } from "node:test";
import { isCacheFresh, resolveFxCache } from "./cache-policy";
import { quoteCacheFromErApiPayload } from "./er-api";
import { convertEurTotal, currencyTotalsFromBook, bookFromQuoteCache } from "./convert";
import { FX_CACHE_TTL_SECONDS } from "./types";

const NOW = Date.parse("2026-08-25T12:00:00.000Z");
const SAMPLE_ER = {
  result: "success",
  base_code: "EUR",
  time_last_update_unix: 1756123200,
  rates: { EUR: 1, USD: 1.2, TRY: 40, RUB: 97, GBP: 0.85 },
};

function sampleRecord(fetchedAtMs: number) {
  return quoteCacheFromErApiPayload(SAMPLE_ER, fetchedAtMs);
}

test("fresh 24-hour cache does not call ExchangeRate-API", async () => {
  const record = sampleRecord(NOW - 60_000);
  let fetches = 0;
  const result = await resolveFxCache({
    nowMs: NOW,
    loadActive: async () => record,
    fetchLatest: async () => {
      fetches += 1;
      throw new Error("should_not_fetch");
    },
    save: async () => {
      throw new Error("should_not_save");
    },
    onError: () => {},
  });
  assert.equal(fetches, 0);
  assert.equal(result.fetchedExternal, false);
  assert.equal(result.record?.USD, record.USD);
  assert.equal(isCacheFresh(record.expiresAt, NOW), true);
  assert.equal(FX_CACHE_TTL_SECONDS, 86400);
});

test("expired cache refreshes from ExchangeRate-API", async () => {
  const stale = sampleRecord(NOW - FX_CACHE_TTL_SECONDS * 1000 - 1);
  let fetches = 0;
  let saved = 0;
  const result = await resolveFxCache({
    nowMs: NOW,
    loadActive: async () => stale,
    fetchLatest: async () => {
      fetches += 1;
      return SAMPLE_ER;
    },
    save: async () => {
      saved += 1;
    },
    onError: () => {},
  });
  assert.equal(fetches, 1);
  assert.equal(saved, 1);
  assert.equal(result.fetchedExternal, true);
  assert.equal(result.usedLastSuccess, false);
  assert.equal(result.record?.fetchedAt, new Date(NOW).toISOString());
});

test("API failure keeps last successful rates and never yields 0", async () => {
  const lastGood = sampleRecord(NOW - FX_CACHE_TTL_SECONDS * 1000 - 5_000);
  let saved = 0;
  const result = await resolveFxCache({
    nowMs: NOW,
    loadActive: async () => lastGood,
    fetchLatest: async () => {
      throw new Error("http_error");
    },
    save: async () => {
      saved += 1;
    },
    onError: () => {},
  });
  assert.equal(saved, 0);
  assert.equal(result.usedLastSuccess, true);
  assert.equal(result.record?.USD, lastGood.USD);
  const totals = currencyTotalsFromBook(40, bookFromQuoteCache(result.record!));
  assert.equal(totals.find((item) => item.code === "EUR")?.amount, 40);
  assert.equal(totals.find((item) => item.code === "USD")?.amount, 48);
  assert.equal(totals.find((item) => item.code === "TRY")?.amount, 1600);
  assert.equal(totals.find((item) => item.code === "GBP")?.amount, 34);
  assert.equal(totals.find((item) => item.code === "RUB")?.amount, 4120);
  assert.ok((totals.find((item) => item.code === "USD")?.amount ?? 0) > 0);
  assert.equal(convertEurTotal(40, bookFromQuoteCache(lastGood).USD!).display, 48);
});

test("failed request does not overwrite the last successful cache", async () => {
  const lastGood = sampleRecord(NOW - FX_CACHE_TTL_SECONDS * 1000 - 5_000);
  let saved = 0;
  const result = await resolveFxCache({
    nowMs: NOW,
    loadActive: async () => lastGood,
    fetchLatest: async () => {
      throw new Error("http_error");
    },
    save: async () => {
      saved += 1;
    },
    onError: () => {},
  });
  assert.equal(saved, 0);
  assert.equal(result.record?.TRY, lastGood.TRY);
  assert.equal(result.record?.RUB, lastGood.RUB);
});

test("invalid payload is not saved over the last successful cache", async () => {
  const lastGood = sampleRecord(NOW - FX_CACHE_TTL_SECONDS * 1000 - 5_000);
  let saved = 0;
  const result = await resolveFxCache({
    nowMs: NOW,
    loadActive: async () => lastGood,
    fetchLatest: async () => ({
      result: "error",
      base_code: "EUR",
      rates: { EUR: 1, USD: 1.2, TRY: 40, RUB: 97, GBP: 0.85 },
    }),
    save: async () => {
      saved += 1;
    },
    onError: () => {},
  });
  assert.equal(saved, 0);
  assert.equal(result.usedLastSuccess, true);
  assert.equal(result.record?.TRY, lastGood.TRY);
});

test("missing currency in API response is not saved", async () => {
  const lastGood = sampleRecord(NOW - FX_CACHE_TTL_SECONDS * 1000 - 5_000);
  let saved = 0;
  const result = await resolveFxCache({
    nowMs: NOW,
    loadActive: async () => lastGood,
    fetchLatest: async () => ({
      result: "success",
      base_code: "EUR",
      rates: { EUR: 1, USD: 1.2, TRY: 40, GBP: 0.85 },
    }),
    save: async () => {
      saved += 1;
    },
    onError: () => {},
  });
  assert.equal(saved, 0);
  assert.equal(result.usedLastSuccess, true);
  assert.equal(result.record?.RUB, lastGood.RUB);
});

test("first failure without any cache keeps EUR and leaves other currencies unset", async () => {
  const result = await resolveFxCache({
    nowMs: NOW,
    loadActive: async () => null,
    fetchLatest: async () => {
      throw new Error("http_error");
    },
    save: async () => {},
    onError: () => {},
  });
  assert.equal(result.record, null);
  const totals = currencyTotalsFromBook(39.92, {});
  assert.equal(totals.find((item) => item.code === "EUR")?.amount, 39.92);
  assert.equal(totals.find((item) => item.code === "USD")?.amount, null);
  assert.equal(totals.find((item) => item.code === "RUB")?.amount, null);
});

test("parallel refresh callers share one in-flight fetch", async () => {
  let fetches = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let current: Promise<unknown> | null = null;
  function run() {
    if (!current) {
      current = resolveFxCache({
        nowMs: NOW,
        loadActive: async () => null,
        fetchLatest: async () => {
          fetches += 1;
          await gate;
          return SAMPLE_ER;
        },
        save: async () => {},
        onError: () => {},
      }).finally(() => {
        current = null;
      });
    }
    return current;
  }
  const pending = Promise.all([run(), run(), run()]);
  release();
  await pending;
  assert.equal(fetches, 1);
});
