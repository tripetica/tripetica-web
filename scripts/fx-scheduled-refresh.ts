import { loadLocalEnv } from "./load-env";

loadLocalEnv();

/**
 * Durable scheduled FX refresh gate.
 * Runs under systemd timer; only calls the production refresh path when
 * now >= provider time_next_update + 15 minutes (not Tripetica fetch + 24h).
 */
async function main() {
  const { sendPendingReservationConfirmationEmails } = await import(
    "../lib/mail/send-reservation-confirmation"
  );
  const { sendPendingOperationReservationNotifications } = await import(
    "../lib/mail/send-operation-reservation-notification"
  );
  const { closeSmtpTransports } = await import("../lib/mail/smtp");
  try {
    const mailResult = await sendPendingReservationConfirmationEmails(10);
    if (mailResult.processed > 0) {
      console.log(
        `Reservation email queue: processed=${mailResult.processed} sent=${mailResult.sent} failed=${mailResult.failed}`,
      );
    }
    const operationMailResult =
      await sendPendingOperationReservationNotifications(10);
    if (operationMailResult.processed > 0) {
      console.log(
        `Operation email queue: processed=${operationMailResult.processed} sent=${operationMailResult.sent} failed=${operationMailResult.failed}`,
      );
    }
  } finally {
    closeSmtpTransports();
  }

  const { refreshFxQuotes } = await import("../lib/booking/fx/service");
  const {
    loadActiveQuoteCache,
    loadLatestFxFetchAttempt,
  } = await import("../lib/booking/fx/store");
  const {
    isScheduledRetryBackoffActive,
    isTripeticaScheduledFetchDue,
    tripeticaScheduledFetchAtMs,
  } = await import("../lib/booking/fx/schedule");
  const {
    FX_PROVIDER_FETCH_BUFFER_MS,
  } = await import("../lib/booking/fx/types");

  const nowMs = Date.now();
  const active = await loadActiveQuoteCache();
  if (!active?.providerNextUpdateAt) {
    console.log(
      "ExchangeRate-API schedule: skip (no provider_next_update_at on active cache)",
    );
    return;
  }

  const dueAt = tripeticaScheduledFetchAtMs(active.providerNextUpdateAt);
  if (dueAt == null) {
    console.log("ExchangeRate-API schedule: skip (invalid provider_next_update_at)");
    return;
  }

  if (
    !isTripeticaScheduledFetchDue({
      providerNextUpdateAt: active.providerNextUpdateAt,
      nowMs,
    })
  ) {
    console.log(
      `ExchangeRate-API schedule: not due (providerNext=${active.providerNextUpdateAt}; tripeticaDue=${new Date(dueAt).toISOString()}; bufferMs=${FX_PROVIDER_FETCH_BUFFER_MS})`,
    );
    return;
  }

  const latestAttempt = await loadLatestFxFetchAttempt();
  if (
    isScheduledRetryBackoffActive({
      lastAttemptAtMs: latestAttempt
        ? Date.parse(latestAttempt.fetchedAt)
        : null,
      lastAttemptStatus: latestAttempt?.status ?? null,
      nowMs,
    })
  ) {
    console.log(
      `ExchangeRate-API schedule: retry backoff active (lastError=${latestAttempt?.errorCode ?? "error"} at ${latestAttempt?.fetchedAt})`,
    );
    return;
  }

  // Already completed the scheduled pull for this provider next-update window.
  const fetchedAtMs = Date.parse(active.fetchedAt);
  if (Number.isFinite(fetchedAtMs) && fetchedAtMs >= dueAt) {
    console.log(
      `ExchangeRate-API schedule: skip (active fetch ${active.fetchedAt} already at/after due ${new Date(dueAt).toISOString()})`,
    );
    return;
  }

  console.log(
    `ExchangeRate-API schedule: due — forcing production refresh (providerNext=${active.providerNextUpdateAt}; due=${new Date(dueAt).toISOString()})`,
  );
  const result = await refreshFxQuotes({ force: true });
  if (result.ok && result.record) {
    console.log("ExchangeRate-API schedule: ok");
    console.log(`fetchedAt=${result.record.fetchedAt}`);
    console.log(`providerNextUpdateAt=${result.record.providerNextUpdateAt}`);
    console.log(`EUR_TO_USD=${result.record.USD}`);
    console.log(`EUR_TO_TRY=${result.record.TRY}`);
    console.log(`EUR_TO_RUB=${result.record.RUB}`);
    console.log(`EUR_TO_GBP=${result.record.GBP}`);
    return;
  }

  console.error(
    `ExchangeRate-API schedule: failed (${result.error ?? "error"}); last successful cache kept`,
  );
  process.exitCode = 1;
}

void main();
