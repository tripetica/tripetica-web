import { after, NextRequest, NextResponse } from "next/server";
import { maybeStartEmergencyReservationVoiceAlert } from "@/lib/alerts/emergency-reservation-voice-alert";
import { sendPaymentConfirmationEmail } from "@/lib/mail/send-payment-confirmation";
import { sendReservationConfirmationEmail } from "@/lib/mail/send-reservation-confirmation";
import { sendOperationReservationNotification } from "@/lib/mail/send-operation-reservation-notification";
import { notifyOpsReservationConfirmed } from "@/lib/ops/push/notify-reservation";
import { scheduleOpsPush } from "@/lib/ops/push/schedule";
import {
  dispatchDuePartnerJobPushes,
  notifyPartnerJobVisibility,
} from "@/lib/partner/push/notify-job-release";
import { schedulePartnerPush } from "@/lib/partner/push/schedule";
import {
  parseTurinvoiceCallbackBody,
  processTurinvoiceCallback,
} from "@/lib/payments/turinvoice/process-callback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        const params = new URLSearchParams(text);
        body = Object.fromEntries(params.entries());
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const payload = parseTurinvoiceCallbackBody(body);
  if (!payload) {
    return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
  }

  try {
    const result = await processTurinvoiceCallback(payload);
    if (!result.ok) {
      if (result.reason === "unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (result.reason === "not-found") {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (result.reason === "mismatch") {
        return NextResponse.json({ error: "Amount mismatch" }, { status: 409 });
      }
      return NextResponse.json({ error: "Invalid callback" }, { status: 400 });
    }

    if (
      result.sendPaymentConfirmation &&
      result.reservationId &&
      (result.outcome === "paid" || result.outcome === "already-paid")
    ) {
      try {
        await sendPaymentConfirmationEmail(result.reservationId);
      } catch (error) {
        console.error("[reservation-mail] payment confirmation hook failed", {
          reservationId: result.reservationId,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : error,
        });
      }
    }
    if (result.sendReservationNotifications && result.reservationId) {
      after(async () => {
        try {
          await sendReservationConfirmationEmail(result.reservationId!);
        } catch (error) {
          console.error("[reservation-mail] paid confirmation hook failed", {
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
          await sendOperationReservationNotification(result.reservationId!);
        } catch (error) {
          console.error("[operation-mail] paid notification hook failed", {
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
          await maybeStartEmergencyReservationVoiceAlert(result.reservationId!);
        } catch (error) {
          console.error("[voice-alert] paid confirmation hook failed", {
            reservationId: result.reservationId,
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : error,
          });
        }
      });
      scheduleOpsPush("reservation-confirmed", () =>
        notifyOpsReservationConfirmed(result.reservationId!),
      );
      schedulePartnerPush("partner-job-released", async () => {
        await notifyPartnerJobVisibility(result.reservationId!);
        await dispatchDuePartnerJobPushes();
      });
    }

    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (error) {
    console.error("[Turinvoice callback] failed", error);
    return NextResponse.json({ error: "Callback processing failed" }, { status: 500 });
  }
}
