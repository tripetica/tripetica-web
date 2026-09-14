import { after, NextRequest, NextResponse } from "next/server";
import { attachBookingSuccessCookie } from "@/lib/booking/booking-success-context";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { type CheckoutPaymentMethod } from "@/lib/booking/checkout-complete";
import {
  completeCashReservation,
  completeSbpReservation,
} from "@/lib/booking/complete-reservation";
import { notifyOpsReservationConfirmed } from "@/lib/ops/push/notify-reservation";
import { scheduleOpsPush } from "@/lib/ops/push/schedule";
import {
  dispatchDuePartnerJobPushes,
  notifyPartnerJobVisibility,
} from "@/lib/partner/push/notify-job-release";
import { schedulePartnerPush } from "@/lib/partner/push/schedule";
import { sendOperationReservationNotification } from "@/lib/mail/send-operation-reservation-notification";
import { sendReservationConfirmationEmail } from "@/lib/mail/send-reservation-confirmation";
import { isLocale } from "@/lib/i18n/config";
import { getAccountActor } from "@/lib/account/session";
import { checkReservationCompletionRateLimit } from "@/lib/booking/completion-rate-limit";
import { requestClientIp } from "@/lib/security/request-client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPayment(value: unknown): value is CheckoutPaymentMethod {
  return value === "cash" || value === "sbp";
}

export async function POST(request: NextRequest) {
  const browserSessionId = readBrowserSessionId(request);
  if (!browserSessionId) {
    return NextResponse.json({ error: "No active search" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const locale = typeof record.locale === "string" && isLocale(record.locale) ? record.locale : null;
  if (!locale) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  if (!isPayment(record.payment)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }
  if (record.legalAccepted !== true) {
    return NextResponse.json({ error: "Legal consent required" }, { status: 400 });
  }

  const captchaToken =
    typeof record.captchaToken === "string" ? record.captchaToken : null;
  const acceptAdjustedPickup = record.acceptAdjustedPickup === true;
  const expectedPickupAtLocal =
    typeof record.expectedPickupAtLocal === "string"
      ? record.expectedPickupAtLocal
      : null;
  const actor = await getAccountActor();
  const customerUserId = actor?.emailVerifiedAt ? actor.id : null;

  try {
    const rateLimit = await checkReservationCompletionRateLimit({
      browserSessionId,
      ip: await requestClientIp(),
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many completion attempts",
          errorCode: "RESERVATION_COMPLETION_RATE_LIMITED",
        },
        { status: 429 },
      );
    }

    const result =
      record.payment === "cash"
        ? await completeCashReservation({
            browserSessionId,
            payment: "cash",
            legalAccepted: true,
            captchaToken,
            customerUserId,
            acceptAdjustedPickup,
            expectedPickupAtLocal,
          })
        : await completeSbpReservation({
            browserSessionId,
            payment: "sbp",
            legalAccepted: true,
            captchaToken,
            customerUserId,
            acceptAdjustedPickup,
            expectedPickupAtLocal,
          });

    if (result.status === "unsupported-payment") {
      return NextResponse.json({ error: "Payment method not supported yet" }, { status: 400 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (result.status === "not-found") {
      return NextResponse.json({ error: "No active search" }, { status: 404 });
    }
    if (result.status === "pickup-prep-insufficient") {
      return NextResponse.json(
        {
          error: "Pickup preparation time insufficient",
          reason: "pickup-prep-insufficient",
          errorCode: "RESERVATION_TIME_INSUFFICIENT",
          suggestedPickupAtLocal: result.suggestedPickupAtLocal,
        },
        { status: 409 },
      );
    }
    if (result.status === "bosphorus-day-cutoff") {
      return NextResponse.json(
        {
          error: "Bosphorus same-day booking cutoff passed",
          reason: "bosphorus-day-cutoff",
          errorCode: "BOSPHORUS_DAY_CUTOFF",
          suggestedPickupAtLocal: result.suggestedPickupAtLocal,
        },
        { status: 409 },
      );
    }
    if (result.status === "pickup-prep-stale") {
      return NextResponse.json(
        {
          error: "Pickup preparation time stale",
          reason: "pickup-prep-stale",
          errorCode: "RESERVATION_TIME_STALE",
          suggestedPickupAtLocal: result.suggestedPickupAtLocal,
        },
        { status: 409 },
      );
    }
    if (result.status === "invalid") {
      const errorCode =
        result.reason === "unapplied-changes"
          ? "RESERVATION_CHECKOUT_INCOMPLETE"
          : result.reason === "sbp-gbp"
            ? "SBP_GBP_UNSUPPORTED"
            : "RESERVATION_CHECKOUT_INVALID";
      return NextResponse.json(
        { error: "Checkout incomplete", reason: result.reason, errorCode },
        { status: 400 },
      );
    }
    if (result.status === "edit-review-only") {
      return NextResponse.json({
        ok: false,
        editReviewOnly: true,
        originalReservationId: result.originalReservationId,
        originalReservationCode: result.originalReservationCode,
        originalTotal: result.originalTotal,
        originalCurrency: result.originalCurrency,
        newTotal: result.newTotal,
        newCurrency: result.newCurrency,
        difference: result.difference,
      });
    }

    if (result.next === "success") {
      // Reservation and durable email queue are committed. Delivery starts
      // after the response; the scheduled worker retries interrupted sends.
      after(async () => {
        try {
          await sendReservationConfirmationEmail(result.reservationId);
        } catch (error) {
          console.error("[reservation-mail] confirmation hook failed", {
            reservationId: result.reservationId,
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : error,
          });
        }
      });
      after(async () => {
        try {
          await sendOperationReservationNotification(result.reservationId);
        } catch (error) {
          console.error("[operation-mail] notification hook failed", {
            reservationId: result.reservationId,
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : error,
          });
        }
      });
      scheduleOpsPush("reservation-confirmed", () =>
        notifyOpsReservationConfirmed(result.reservationId),
      );
      schedulePartnerPush("partner-job-released", async () => {
        await notifyPartnerJobVisibility(result.reservationId);
        await dispatchDuePartnerJobPushes();
      });
    }

    const response = NextResponse.json({
      ok: true,
      alreadyExisted: result.alreadyExisted,
      next: result.next,
    });
    return attachBookingSuccessCookie(response, result.reservationId, request);
  } catch (error) {
    const pgCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;
    console.error("[Tripetica complete-reservation]", error);
    return NextResponse.json(
      {
        error: "Could not complete reservation",
        errorCode: "RESERVATION_CREATE_FAILED",
        ...(pgCode ? { pgCode } : {}),
      },
      { status: 500 },
    );
  }
}
