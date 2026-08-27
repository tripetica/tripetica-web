import "server-only";

import { isCacheFresh, resolveFxCache } from "@/lib/booking/fx/cache-policy";
import { bookFromQuoteCache } from "@/lib/booking/fx/convert";
import {
  loadActiveQuoteCache,
  logFxFetchAttempt,
  saveQuoteCache,
} from "@/lib/booking/fx/store";
import { type FxBook, type FxQuoteCacheRecord } from "@/lib/booking/fx/types";

const ER_API_LATEST_URL = "https://open.er-api.com/v6/latest/EUR";
const FETCH_MS = 15_000;
const FAILURE_RETRY_MS = 10 * 60 * 1000;

type FxRefreshState = {
  record: FxQuoteCacheRecord | null;
  error: string | null;
  usedLastSuccess: boolean;
};

const globalForFx = globalThis as typeof globalThis & {
  tripeticaFxRefresh?: Promise<FxRefreshState>;
  tripeticaFxLastFailureMs?: number;
};

export function logFxError(code: string, detail?: unknown) {
  console.error("[Tripetica fx] ExchangeRate-API Open Access", code);
  if (detail instanceof Error) {
    console.error(detail.name, detail.message);
    return;
  }
  if (detail != null) {
    console.error(String(detail));
  }
}

function rememberFailure(error: string | null) {
  if (error) {
    globalForFx.tripeticaFxLastFailureMs = Date.now();
    return;
  }
  globalForFx.tripeticaFxLastFailureMs = undefined;
}

async function fetchErApiLatest(): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetch(ER_API_LATEST_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("http_error");
    }
    const text = await response.text();
    if (!text.trim()) {
      throw new Error("empty_body");
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("invalid_json");
    }
  } finally {
    clearTimeout(timer);
  }
}

async function resolveActiveCache(force = false): Promise<FxRefreshState> {
  const result = await resolveFxCache({
    nowMs: Date.now(),
    force,
    loadActive: loadActiveQuoteCache,
    fetchLatest: fetchErApiLatest,
    save: saveQuoteCache,
    onError: logFxError,
  });
  if (result.fetchedExternal) {
    await logFxFetchAttempt({
      status: result.error ? "error" : "ok",
      errorCode: result.error,
    });
  }
  if (!result.record) {
    logFxError(
      result.error ?? "missing_rate",
      "no successful ExchangeRate-API cache yet; keeping EUR totals only",
    );
  }
  return {
    record: result.record,
    error: result.error,
    usedLastSuccess: result.usedLastSuccess,
  };
}

async function refreshInFlight(force: boolean): Promise<FxRefreshState> {
  if (globalForFx.tripeticaFxRefresh) {
    return globalForFx.tripeticaFxRefresh;
  }
  globalForFx.tripeticaFxRefresh = resolveActiveCache(force).finally(() => {
    globalForFx.tripeticaFxRefresh = undefined;
  });
  return globalForFx.tripeticaFxRefresh;
}

export async function getActiveFxBook(): Promise<FxBook> {
  try {
    const existing = await loadActiveQuoteCache();
    if (existing && isCacheFresh(existing.expiresAt, Date.now())) {
      return bookFromQuoteCache(existing);
    }
    const failedAt = globalForFx.tripeticaFxLastFailureMs;
    if (existing && failedAt && Date.now() - failedAt < FAILURE_RETRY_MS) {
      return bookFromQuoteCache(existing);
    }
    const refreshed = await refreshInFlight(false);
    rememberFailure(refreshed.error);
    return refreshed.record ? bookFromQuoteCache(refreshed.record) : {};
  } catch (error) {
    logFxError("load_failed", error);
    return {};
  }
}

export async function refreshFxQuotes(options?: { force?: boolean }): Promise<{
  ok: boolean;
  record: FxQuoteCacheRecord | null;
  usedLastSuccess: boolean;
  error: string | null;
}> {
  const force = options?.force === true;
  try {
    if (!force) {
      const existing = await loadActiveQuoteCache();
      if (existing && isCacheFresh(existing.expiresAt, Date.now())) {
        return {
          ok: true,
          record: existing,
          usedLastSuccess: false,
          error: null,
        };
      }
    }
    const refreshed = await refreshInFlight(force);
    rememberFailure(refreshed.error);
    return {
      ok: Boolean(refreshed.record) && !refreshed.usedLastSuccess && !refreshed.error,
      record: refreshed.record,
      usedLastSuccess: refreshed.usedLastSuccess,
      error: refreshed.error,
    };
  } catch (error) {
    logFxError("load_failed", error);
    const existing = await loadActiveQuoteCache();
    return {
      ok: false,
      record: existing,
      usedLastSuccess: Boolean(existing),
      error: "load_failed",
    };
  }
}
