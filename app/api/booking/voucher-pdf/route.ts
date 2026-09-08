import { NextRequest, NextResponse } from "next/server";
import {
  readBookingSuccessReservationId,
  resolveBookingSuccessContext,
} from "@/lib/booking/booking-success-context";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { buildReservationVoucherPdf } from "@/lib/booking/reservation-voucher-pdf";
import {
  findReservationVoucherById,
  voucherPdfFilename,
} from "@/lib/booking/reservation-voucher-access";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public voucher download for the just-completed booking success flow.
 * Reservation is resolved only from HttpOnly success cookie + browser session —
 * never from a reservation code or id in the query string.
 */
export async function GET(request: NextRequest) {
  const browserSessionId = readBrowserSessionId(request);
  if (!browserSessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const successReservationId = readBookingSuccessReservationId(request);
  if (!successReservationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const localeParam = request.nextUrl.searchParams.get("locale");
  const locale = localeParam && isLocale(localeParam) ? localeParam : "tr";

  try {
    const context = await resolveBookingSuccessContext(
      browserSessionId,
      successReservationId,
    );
    if (!context) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const voucher = await findReservationVoucherById(context.reservationId, locale);
    if (!voucher) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const pdf = await buildReservationVoucherPdf(voucher, locale);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${voucherPdfFilename(context.reservationCode)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[Tripetica voucher-pdf]", error);
    return NextResponse.json({ error: "Could not generate PDF" }, { status: 500 });
  }
}
