import { redirect } from "next/navigation";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { opsCopy } from "@/lib/ops/copy";
import { isUuid } from "@/lib/ops/process-filters";
import { getReservation } from "@/lib/ops/reservations";
import { buildOpsRecordPdf } from "@/lib/ops/pdf";
import { toReservationRecordDetail } from "@/lib/ops/record-detail";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
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
  const includeContact =
    new URL(request.url).searchParams.get("includeContact") === "1";
  const copy = opsCopy[asPanelLocale(locale)];
  const detail = toReservationRecordDetail(item, locale, copy);
  const pdf = await buildOpsRecordPdf(detail, copy, { includeContact });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${detail.pdfFilename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
