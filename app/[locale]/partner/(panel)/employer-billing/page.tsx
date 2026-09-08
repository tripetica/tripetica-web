import { notFound } from "next/navigation";
import { PartnerEmployerBillingCard } from "@/components/partner/employer-billing-card";
import { isLocale } from "@/lib/i18n/config";
import { partnerCopy } from "@/lib/partner/copy";
import { getEmployerBillingProfile } from "@/lib/partner/employer-billing";

export const dynamic = "force-dynamic";

export default async function PartnerEmployerBillingPage({
  params,
}: PageProps<"/[locale]/partner/employer-billing">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const copy = partnerCopy[locale];
  const profile = await getEmployerBillingProfile();

  return (
    <div className="ops-page">
      <div className="ops-page-head">
        <h1 id="partner-billing-title">{copy.employerBilling}</h1>
      </div>
      {profile ? (
        <PartnerEmployerBillingCard copy={copy} profile={profile} />
      ) : (
        <div className="partner-empty">
          <p className="partner-empty-lead">{copy.billingUnavailable}</p>
        </div>
      )}
    </div>
  );
}
