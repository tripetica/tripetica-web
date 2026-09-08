import "server-only";

import webpush from "web-push";
import { readOpsPushVapidConfig } from "@/lib/ops/push/config";
import {
  disableOpsPushSubscription,
  listActiveOpsPushSubscriptions,
} from "@/lib/ops/push/subscriptions";
import { type OpsPushPayload } from "@/lib/ops/push/payload";

function isGoneStatus(statusCode: number | undefined) {
  return statusCode === 404 || statusCode === 410;
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const value = (error as { statusCode?: unknown }).statusCode;
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
}

export async function sendOpsPushToActiveSubscriptions(
  payload: OpsPushPayload,
): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const vapid = readOpsPushVapidConfig();
  if (!vapid) {
    console.error("[ops-push] VAPID is not configured");
    return { sent: 0, failed: 0, skipped: true };
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const subscriptions = await listActiveOpsPushSubscriptions();
  let sent = 0;
  let failed = 0;
  const body = JSON.stringify(payload);

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = errorStatus(error);
      if (isGoneStatus(statusCode)) {
        try {
          await disableOpsPushSubscription(subscription.endpoint);
        } catch (disableError) {
          console.error("[ops-push] failed to disable stale subscription", {
            endpoint: subscription.endpoint,
            error:
              disableError instanceof Error
                ? { name: disableError.name, message: disableError.message }
                : disableError,
          });
        }
      } else {
        console.error("[ops-push] send failed", {
          endpoint: subscription.endpoint,
          statusCode,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : error,
        });
      }
    }
  }

  return { sent, failed, skipped: false };
}
