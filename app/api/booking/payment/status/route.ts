import { NextRequest, NextResponse } from "next/server";
import { readBookingSuccessReservationId } from "@/lib/booking/booking-success-cookie";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import {
  loadBookingPaymentStatus,
  refreshPendingPaymentFromProvider,
} from "@/lib/payments/booking-payment-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const browserSessionId = readBrowserSessionId(request);
  const reservationId = readBookingSuccessReservationId(request);
  if (!browserSessionId || !reservationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const view = refresh
    ? await refreshPendingPaymentFromProvider(reservationId, browserSessionId)
    : await loadBookingPaymentStatus(reservationId, browserSessionId);

  if (!view) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    reservationCode: view.reservationCode,
    status: view.status,
    paymentMethod: view.paymentMethod,
    paymentStatus: view.paymentStatus,
    paid: view.paid,
    pendingPayment: view.pendingPayment,
  });
}
