import { notFound } from "next/navigation";
import { PartnerJobDetail } from "@/components/partner/job-detail";
import { isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { listAssignablePartnerDrivers, listAssignablePartnerVehicles } from "@/lib/partner/fleet";
import { loadPartnerJobAssignment, emptyJobAssignment } from "@/lib/partner/job-assignment";
import { getPartnerJob } from "@/lib/partner/jobs";

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
  const [assignment, drivers, vehicles] = await Promise.all([
    loadPartnerJobAssignment({
      reservationId: job.id,
      partnerId: actor.partnerId,
    }),
    listAssignablePartnerDrivers(actor.partnerId),
    listAssignablePartnerVehicles(actor.partnerId),
  ]);

  return (
    <div className="ops-page partner-profile-page partner-job-detail-page">
      <PartnerJobDetail
        locale={locale}
        copy={partnerCopy[locale]}
        job={job}
        isPrimaryPartner={actor.isPrimaryPartner}
        assignment={assignment ?? emptyJobAssignment()}
        drivers={drivers}
        vehicles={vehicles}
      />
    </div>
  );
}
