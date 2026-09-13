import { NextResponse } from "next/server";
import { requireVerifiedAccountActor } from "@/lib/account/reservation-access";
import { getAccountReservation } from "@/lib/account/reservations";
import { buildReservationVoucherPdf } from "@/lib/booking/reservation-voucher-pdf";
import {
  findReservationVoucherById,
  voucherPdfFilename,
} from "@/lib/booking/reservation-voucher-access";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Customer voucher PDF download. Ownership is enforced via account session +
 * customer_user_id / email match — never trust id alone.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ locale: string; id: string }> },
) {
  const { locale: localeRaw, id } = await context.params;
  if (!isLocale(localeRaw)) {
    return new NextResponse(null, { status: 404 });
  }
  const locale = localeRaw;
  const access = await requireVerifiedAccountActor();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.reason === "unverified" ? "Forbidden" : "Unauthorized" },
      { status: access.reason === "unverified" ? 403 : 401 },
    );
  }

  const owned = await getAccountReservation(access.actor.id, id);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const voucher = await findReservationVoucherById(owned.id, locale);
    if (!voucher) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const pdf = await buildReservationVoucherPdf(voucher, voucher.locale);
    const filename = voucherPdfFilename(
      owned.reservationCode || voucher.reservationCode,
    );
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[account voucher-pdf]", error);
    return NextResponse.json({ error: "Could not generate PDF" }, { status: 500 });
  }
}
