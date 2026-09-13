import { notFound } from "next/navigation";
import { AcceptedJobFilters } from "@/components/partner/accepted-job-filters";
import { PartnerJobList } from "@/components/partner/job-list";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import {
  firstSearchParam,
  hasActivePartnerAcceptedJobFilters,
  parsePartnerAcceptedJobFilters,
} from "@/lib/partner/accepted-job-filters";
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
  const filters = parsePartnerAcceptedJobFilters({
    date: firstSearchParam(query.date),
    from: firstSearchParam(query.from),
    to: firstSearchParam(query.to),
    operation: firstSearchParam(query.operation),
  });
  const copy = partnerCopy[asPanelLocale(locale)];
  const emptyLabel =
    filters.operation === "completed"
      ? copy.jobAcceptedCompletedEmpty
      : hasActivePartnerAcceptedJobFilters(filters)
        ? copy.jobAcceptedFilterEmpty
        : copy.jobAcceptedEmpty;
  const [jobs, drivers, vehicles] = await Promise.all([
    listAcceptedPartnerJobs(
      {
        partnerId: actor.partnerId,
        userId: actor.userId,
        isPrimaryPartner: actor.isPrimaryPartner,
        locale,
      },
      filters,
    ),
    listAssignablePartnerDrivers(actor.partnerId),
    listAssignablePartnerVehicles(actor.partnerId),
  ]);

  return (
    <div className="ops-page partner-jobs-page partner-jobs-accepted">
      <AcceptedJobFilters locale={locale} copy={copy} filters={filters} />
      <PartnerJobList
        locale={locale}
        copy={copy}
        jobs={jobs}
        mode="accepted"
        justClaimed={justClaimed}
        isPrimaryPartner={actor.isPrimaryPartner}
        drivers={drivers}
        vehicles={vehicles}
        emptyLabel={emptyLabel}
      />
    </div>
  );
}
