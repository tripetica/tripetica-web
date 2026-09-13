import { redirect } from "next/navigation";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { buildReservationVoucherPdf } from "@/lib/booking/reservation-voucher-pdf";
import { findReservationVoucherById } from "@/lib/booking/reservation-voucher-access";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { opsCopy } from "@/lib/ops/copy";
import { isUuid } from "@/lib/ops/process-filters";
import { reservationVoucherPdfFilename } from "@/lib/ops/record-detail";
import { getReservation } from "@/lib/ops/reservations";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ locale: string; id: string }> },
) {
  const { locale, id } = await context.params;
  if (!isLocale(locale)) {
    return new Response(null, { status: 404 });
  }
  const actor = await getOpsActor();
  if (!actor) {
    redirect(localizedPath(locale, "/ops/login"));
  }
  if (!actorCan(actor, "reservations.view")) {
    return new Response(opsCopy[asPanelLocale(locale)].forbidden, { status: 403 });
  }
  if (!isUuid(id)) {
    return new Response(null, { status: 404 });
  }
  const item = await getReservation(id);
  if (!item) {
    return new Response(null, { status: 404 });
  }
  const voucher = await findReservationVoucherById(id, locale);
  if (!voucher) {
    return new Response(null, { status: 404 });
  }
  const pdf = await buildReservationVoucherPdf(voucher, voucher.locale);
  const filename = reservationVoucherPdfFilename(
    item.reservationCode || voucher.reservationCode,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
