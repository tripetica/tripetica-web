import { notFound } from "next/navigation";
import { PartnerJobList } from "@/components/partner/job-list";
import { isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { listOpenPartnerJobs } from "@/lib/partner/jobs";

export const dynamic = "force-dynamic";

export default async function PartnerJobsPage({
  params,
}: PageProps<"/[locale]/partner/jobs">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const copy = partnerCopy[locale];
  const jobs = await listOpenPartnerJobs({
    partnerId: actor.partnerId,
    userId: actor.userId,
    isPrimaryPartner: actor.isPrimaryPartner,
    locale,
  });

  return (
    <div className="ops-page partner-jobs-page">
      <PartnerJobList locale={locale} copy={copy} jobs={jobs} mode="open" />
    </div>
  );
}
