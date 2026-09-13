import { notFound } from "next/navigation";
import { PartnerProfileForm } from "@/components/partner/profile-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { getPartnerSelfProfile } from "@/lib/partner/profile";

export const dynamic = "force-dynamic";

export default async function PartnerProfilePage({
  params,
}: PageProps<"/[locale]/partner/profile">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const copy = partnerCopy[asPanelLocale(locale)];
  const profile = await getPartnerSelfProfile(actor.partnerId);

  return (
    <div className="ops-page partner-profile-page">
      <div className="ops-page-head">
        <h1 id="partner-profile-title">{copy.profile}</h1>
      </div>
      {profile ? (
        <PartnerProfileForm locale={locale} copy={copy} profile={profile} />
      ) : (
        <div className="partner-empty">
          <p className="partner-empty-lead">{copy.comingSoonLead}</p>
        </div>
      )}
    </div>
  );
}
