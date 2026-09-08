import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isScheduledRetryBackoffActive,
  isTripeticaScheduledFetchDue,
  resolveTripeticaNextRefreshAt,
  tripeticaScheduledFetchAtMs,
} from "./schedule";
import { FX_PROVIDER_FETCH_BUFFER_MS, FX_SCHEDULED_RETRY_MS } from "./types";

test("Tripetica scheduled fetch is provider next update + 15 minutes", () => {
  const provider = "2026-09-01T00:27:41.000Z";
  const due = tripeticaScheduledFetchAtMs(provider);
  assert.equal(due, Date.parse(provider) + FX_PROVIDER_FETCH_BUFFER_MS);
  assert.equal(FX_PROVIDER_FETCH_BUFFER_MS, 15 * 60 * 1000);
});

test("scheduled fetch is not due before the buffer elapses", () => {
  const provider = "2026-09-01T00:27:41.000Z";
  const due = tripeticaScheduledFetchAtMs(provider)!;
  assert.equal(
    isTripeticaScheduledFetchDue({
      providerNextUpdateAt: provider,
      nowMs: due - 1,
    }),
    false,
  );
  assert.equal(
    isTripeticaScheduledFetchDue({
      providerNextUpdateAt: provider,
      nowMs: due,
    }),
    true,
  );
});

test("missing provider next update never becomes due", () => {
  assert.equal(
    isTripeticaScheduledFetchDue({
      providerNextUpdateAt: null,
      nowMs: Date.now(),
    }),
    false,
  );
});

test("failed attempts back off for the configured retry window", () => {
  const now = Date.parse("2026-09-01T01:00:00.000Z");
  assert.equal(
    isScheduledRetryBackoffActive({
      lastAttemptAtMs: now - FX_SCHEDULED_RETRY_MS + 1,
      lastAttemptStatus: "error",
      nowMs: now,
    }),
    true,
  );
  assert.equal(
    isScheduledRetryBackoffActive({
      lastAttemptAtMs: now - FX_SCHEDULED_RETRY_MS,
      lastAttemptStatus: "error",
      nowMs: now,
    }),
    false,
  );
  assert.equal(
    isScheduledRetryBackoffActive({
      lastAttemptAtMs: now - 1_000,
      lastAttemptStatus: "ok",
      nowMs: now,
    }),
    false,
  );
});

test("ops next refresh helper returns provider next + buffer (scheduler due)", () => {
  const provider = "2026-09-01T00:27:41.000Z";
  const dueIso = new Date(
    Date.parse(provider) + FX_PROVIDER_FETCH_BUFFER_MS,
  ).toISOString();
  assert.equal(
    resolveTripeticaNextRefreshAt({
      providerNextUpdateAt: provider,
      fetchedAt: "2026-09-01T00:10:00.000Z",
    }),
    dueIso,
  );
  // Still returns due time after fetch — UI shows raw providerNextUpdateAt instead.
  assert.equal(
    resolveTripeticaNextRefreshAt({
      providerNextUpdateAt: provider,
      fetchedAt: dueIso,
    }),
    dueIso,
  );
});
