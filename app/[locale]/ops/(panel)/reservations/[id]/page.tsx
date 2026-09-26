import { notFound } from "next/navigation";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { getReservation } from "@/lib/ops/reservations";
import { toReservationRecordDetail } from "@/lib/ops/record-detail";
import { RecordDetail } from "@/components/ops/record-detail";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { loadUetdsReservationContext } from "@/lib/uetds/reservation-context";
import {
  findActiveUetdsNotificationForReservation,
  uetdsReservationNotifyPath,
} from "@/lib/uetds/reservation-notification";

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
  const [uetdsContext, existingUetds] = await Promise.all([
    loadUetdsReservationContext(item.id),
    findActiveUetdsNotificationForReservation({ reservationId: item.id }),
  ]);
  const uetdsCopy = uetdsFormCopyFor(locale);
  return (
    <section className="ops-page">
      <p>
        <a href={localizedPath(locale, "/ops/reservations")}>{copy.back}</a>
      </p>
      <RecordDetail
        locale={locale}
        copy={copy}
        detail={toReservationRecordDetail(item, locale, copy)}
        uetdsNotify={
          uetdsContext
            ? {
                href: localizedPath(
                  locale,
                  uetdsReservationNotifyPath({
                    panel: "ops",
                    reservationId: item.id,
                    existingId: existingUetds?.id,
                  }),
                ),
                eligibility: uetdsContext.eligibility,
                label: existingUetds ? uetdsCopy.notifyEditAction : uetdsCopy.notifyAction,
              }
            : null
        }
      />
    </section>
  );
}
