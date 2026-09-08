import {
  FX_PROVIDER_FETCH_BUFFER_MS,
  FX_SCHEDULED_RETRY_MS,
} from "@/lib/booking/fx/types";

/** Tripetica automatic fetch instant: provider next update + buffer. */
export function tripeticaScheduledFetchAtMs(providerNextUpdateAt: string): number | null {
  const providerMs = Date.parse(providerNextUpdateAt);
  if (!Number.isFinite(providerMs)) {
    return null;
  }
  return providerMs + FX_PROVIDER_FETCH_BUFFER_MS;
}

/**
 * Next Tripetica FX refresh instant for scheduler gating (provider next + buffer).
 * Ops UI should display providerNextUpdateAt itself, not this derived value.
 */
export function resolveTripeticaNextRefreshAt(input: {
  providerNextUpdateAt: string | null | undefined;
  fetchedAt: string | null | undefined;
}): string | null {
  if (!input.providerNextUpdateAt) {
    return null;
  }
  const dueMs = tripeticaScheduledFetchAtMs(input.providerNextUpdateAt);
  if (dueMs == null) {
    return null;
  }
  return new Date(dueMs).toISOString();
}

export function isTripeticaScheduledFetchDue(input: {
  providerNextUpdateAt: string | null | undefined;
  nowMs: number;
}): boolean {
  if (!input.providerNextUpdateAt) {
    return false;
  }
  const dueAt = tripeticaScheduledFetchAtMs(input.providerNextUpdateAt);
  return dueAt != null && input.nowMs >= dueAt;
}

export function isScheduledRetryBackoffActive(input: {
  lastAttemptAtMs: number | null;
  lastAttemptStatus: "ok" | "error" | null;
  nowMs: number;
}): boolean {
  if (input.lastAttemptStatus !== "error" || input.lastAttemptAtMs == null) {
    return false;
  }
  return input.nowMs - input.lastAttemptAtMs < FX_SCHEDULED_RETRY_MS;
}
