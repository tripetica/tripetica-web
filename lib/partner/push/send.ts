import "server-only";

import webpush from "web-push";
import { readOpsPushVapidConfig } from "@/lib/ops/push/config";
import { type PartnerJobPushPayload } from "@/lib/partner/push/payload";
import {
  disablePartnerPushSubscription,
  type PartnerPushSubscriptionRecord,
} from "@/lib/partner/push/subscriptions";

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

export async function sendPartnerPushToSubscriptions(
  subscriptions: PartnerPushSubscriptionRecord[],
  payloadFor: (subscription: PartnerPushSubscriptionRecord) => PartnerJobPushPayload,
): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const vapid = readOpsPushVapidConfig();
  if (!vapid) {
    console.error("[partner-push] VAPID is not configured");
    return { sent: 0, failed: 0, skipped: true };
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payloadFor(subscription)),
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = errorStatus(error);
      if (isGoneStatus(statusCode)) {
        try {
          await disablePartnerPushSubscription(subscription.endpoint);
        } catch (disableError) {
          console.error("[partner-push] failed to disable stale subscription", {
            endpoint: subscription.endpoint,
            error:
              disableError instanceof Error
                ? { name: disableError.name, message: disableError.message }
                : disableError,
          });
        }
      } else {
        console.error("[partner-push] send failed", {
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
