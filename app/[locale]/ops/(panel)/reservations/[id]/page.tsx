import { notFound } from "next/navigation";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { getReservation } from "@/lib/ops/reservations";
import { toReservationRecordDetail } from "@/lib/ops/record-detail";
import { RecordDetail } from "@/components/ops/record-detail";

export const dynamic = "force-dynamic";

export default async function OpsReservationDetailPage({
  params,
}: PageProps<"/[locale]/ops/reservations/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "reservations.view");
  const item = await getReservation(id);
  if (!item) {
    notFound();
  }
  const copy = opsCopy[asPanelLocale(locale)];
  return (
    <section className="ops-page">
      <p>
        <a href={localizedPath(locale, "/ops/reservations")}>{copy.back}</a>
      </p>
      <RecordDetail locale={locale} copy={copy} detail={toReservationRecordDetail(item, locale, copy)} />
    </section>
  );
}
