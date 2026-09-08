import { NextRequest, NextResponse } from "next/server";
import { readBookingSuccessReservationId } from "@/lib/booking/booking-success-cookie";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { ensureTurinvoiceOrderForReservation } from "@/lib/payments/turinvoice/ensure-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const browserSessionId = readBrowserSessionId(request);
  const reservationId = readBookingSuccessReservationId(request);
  if (!browserSessionId || !reservationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await ensureTurinvoiceOrderForReservation(
    reservationId,
    browserSessionId,
  );

  if (!result.ok) {
    const status =
      result.reason === "forbidden"
        ? 403
        : result.reason === "not-found"
          ? 404
          : result.reason === "provider"
            ? 502
            : 400;
    console.error("[payment/start] failed", {
      httpStatus: status,
      reason: result.reason,
      hasReservationId: Boolean(reservationId),
    });
    return NextResponse.json({ error: "Payment start failed", reason: result.reason }, { status });
  }

  console.info("[payment/start] ok", {
    reused: result.reused,
    hasIdOrder: Boolean(result.idOrder),
    hasPaymentUrl: Boolean(result.paymentUrl),
    paymentHost: (() => {
      try {
        return new URL(result.paymentUrl).host;
      } catch {
        return "invalid";
      }
    })(),
  });

  return NextResponse.json({
    ok: true,
    paymentUrl: result.paymentUrl,
    reused: result.reused,
    reservationCode: result.reservationCode,
  });
}
