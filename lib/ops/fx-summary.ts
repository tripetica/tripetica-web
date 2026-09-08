import "server-only";

import { loadActiveQuoteCache } from "@/lib/booking/fx/store";

export type OpsFxSummary = {
  fetchedAt: string;
  /** Provider ExchangeRate-API `time_next_update_utc` from last successful fetch. */
  providerNextUpdateAt: string | null;
  usd: string;
  tryRate: string;
  rub: string;
  gbp: string;
};

/** Reads the latest successful cached FX quotes. Does not call external APIs. */
export async function loadOpsFxSummary(): Promise<OpsFxSummary | null> {
  const record = await loadActiveQuoteCache();
  if (!record) {
    return null;
  }
  return {
    fetchedAt: record.fetchedAt,
    providerNextUpdateAt: record.providerNextUpdateAt,
    usd: record.USD,
    tryRate: record.TRY,
    rub: record.RUB,
    gbp: record.GBP,
  };
}
