import { notFound } from "next/navigation";
import { PartnerJobDetail } from "@/components/partner/job-detail";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { opsCopy } from "@/lib/ops/copy";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { getDriverTaskForPartner } from "@/lib/partner/driver-task";
import { listAssignablePartnerDrivers, listAssignablePartnerVehicles } from "@/lib/partner/fleet";
import { loadPartnerJobAssignment, emptyJobAssignment } from "@/lib/partner/job-assignment";
import { getPartnerJob } from "@/lib/partner/jobs";
import { localizedPath } from "@/lib/i18n/path";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { loadUetdsReservationContext } from "@/lib/uetds/reservation-context";
import {
  findActiveUetdsNotificationForReservation,
  uetdsReservationNotifyPath,
} from "@/lib/uetds/reservation-notification";

export const dynamic = "force-dynamic";

export default async function PartnerAcceptedJobDetailPage({
  params,
}: PageProps<"/[locale]/partner/accepted/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const job = await getPartnerJob(
    {
      partnerId: actor.partnerId,
      userId: actor.userId,
      isPrimaryPartner: actor.isPrimaryPartner,
      locale,
    },
    id,
  );
  if (!job || !job.accepted) {
    notFound();
  }
  const [assignment, drivers, vehicles, driverTask, uetdsContext, existingUetds] = await Promise.all([
    loadPartnerJobAssignment({
      reservationId: job.id,
      partnerId: actor.partnerId,
    }),
    listAssignablePartnerDrivers(actor.partnerId),
    listAssignablePartnerVehicles(actor.partnerId),
    getDriverTaskForPartner({
      partnerId: actor.partnerId,
      reservationId: job.id,
      locale,
    }),
    loadUetdsReservationContext(job.id),
    findActiveUetdsNotificationForReservation({
      reservationId: job.id,
      partnerId: actor.partnerId,
    }),
  ]);
  const uetdsCopy = uetdsFormCopyFor(locale);

  return (
    <div className="ops-page partner-profile-page partner-job-detail-page">
      <PartnerJobDetail
        locale={locale}
        copy={partnerCopy[asPanelLocale(locale)]}
        job={job}
        isPrimaryPartner={actor.isPrimaryPartner}
        assignment={assignment ?? emptyJobAssignment()}
        drivers={drivers}
        vehicles={vehicles}
        driverTask={driverTask}
        driverTaskCopy={opsCopy[asPanelLocale(locale)]}
        uetdsNotify={
          uetdsContext
            ? {
                href: localizedPath(
                  locale,
                  uetdsReservationNotifyPath({
                    panel: "partner",
                    reservationId: job.id,
                    existingId: existingUetds?.id,
                  }),
                ),
                eligibility: uetdsContext.eligibility,
                label: existingUetds ? uetdsCopy.notifyEditAction : uetdsCopy.notifyAction,
              }
            : null
        }
      />
    </div>
  );
}
