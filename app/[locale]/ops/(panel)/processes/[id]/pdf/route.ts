import { redirect } from "next/navigation";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { opsCopy } from "@/lib/ops/copy";
import { isUuid } from "@/lib/ops/process-filters";
import { getProcess } from "@/lib/ops/processes";
import { buildOpsRecordPdf } from "@/lib/ops/pdf";
import { toProcessRecordDetail } from "@/lib/ops/record-detail";

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
  if (!actorCan(actor, "processes.view")) {
    return new Response(opsCopy[asPanelLocale(locale)].forbidden, { status: 403 });
  }
  if (!isUuid(id)) {
    return new Response(null, { status: 404 });
  }
  const item = await getProcess(id);
  if (!item) {
    return new Response(null, { status: 404 });
  }
  const copy = opsCopy[asPanelLocale(locale)];
  const detail = toProcessRecordDetail(item, locale, copy);
  const pdf = await buildOpsRecordPdf(detail, copy);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${detail.pdfFilename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
