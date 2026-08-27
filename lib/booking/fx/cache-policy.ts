import { quoteCacheFromErApiPayload } from "@/lib/booking/fx/er-api";
import { FX_CACHE_TTL_SECONDS, type FxQuoteCacheRecord } from "@/lib/booking/fx/types";

export { FX_CACHE_TTL_SECONDS };

export function isCacheFresh(expiresAt: string, nowMs: number): boolean {
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires > nowMs;
}

export type ResolveFxCacheInput = {
  nowMs: number;
  force?: boolean;
  loadActive: () => Promise<FxQuoteCacheRecord | null>;
  fetchLatest: () => Promise<unknown>;
  save: (record: FxQuoteCacheRecord) => Promise<void>;
  onError: (code: string, detail?: unknown) => void;
};

export type ResolveFxCacheResult = {
  record: FxQuoteCacheRecord | null;
  fetchedExternal: boolean;
  usedLastSuccess: boolean;
  error: string | null;
};

function errorCode(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "timeout";
  }
  if (error instanceof Error && error.message) {
    return error.message.split(":")[0] ?? "http_error";
  }
  return "http_error";
}

export async function resolveFxCache(
  input: ResolveFxCacheInput,
): Promise<ResolveFxCacheResult> {
  const existing = await input.loadActive();
  if (
    existing &&
    !input.force &&
    isCacheFresh(existing.expiresAt, input.nowMs)
  ) {
    return {
      record: existing,
      fetchedExternal: false,
      usedLastSuccess: false,
      error: null,
    };
  }

  try {
    const payload = await input.fetchLatest();
    const parsed = quoteCacheFromErApiPayload(payload, input.nowMs);
    try {
      await input.save(parsed);
    } catch (saveError) {
      input.onError("save_failed", saveError);
    }
    return {
      record: parsed,
      fetchedExternal: true,
      usedLastSuccess: false,
      error: null,
    };
  } catch (error) {
    const code = errorCode(error);
    input.onError(code, error);
    if (existing) {
      return {
        record: existing,
        fetchedExternal: true,
        usedLastSuccess: true,
        error: code,
      };
    }
    return {
      record: null,
      fetchedExternal: true,
      usedLastSuccess: false,
      error: code,
    };
  }
}
