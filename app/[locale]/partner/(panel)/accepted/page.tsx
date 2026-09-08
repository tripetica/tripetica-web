import { notFound } from "next/navigation";
import { PartnerJobList } from "@/components/partner/job-list";
import { isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { listAssignablePartnerDrivers, listAssignablePartnerVehicles } from "@/lib/partner/fleet";
import { listAcceptedPartnerJobs } from "@/lib/partner/jobs";

export const dynamic = "force-dynamic";

export default async function PartnerAcceptedJobsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/partner/accepted">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const query = await searchParams;
  const claimed = query.claimed;
  const justClaimed = (Array.isArray(claimed) ? claimed[0] : claimed) === "1";
  const copy = partnerCopy[locale];
  const [jobs, drivers, vehicles] = await Promise.all([
    listAcceptedPartnerJobs({
      partnerId: actor.partnerId,
      userId: actor.userId,
      isPrimaryPartner: actor.isPrimaryPartner,
      locale,
    }),
    listAssignablePartnerDrivers(actor.partnerId),
    listAssignablePartnerVehicles(actor.partnerId),
  ]);

  return (
    <div className="ops-page partner-jobs-page partner-jobs-accepted">
      <PartnerJobList
        locale={locale}
        copy={copy}
        jobs={jobs}
        mode="accepted"
        justClaimed={justClaimed}
        isPrimaryPartner={actor.isPrimaryPartner}
        drivers={drivers}
        vehicles={vehicles}
      />
    </div>
  );
}
