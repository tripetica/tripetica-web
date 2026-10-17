import { notFound } from "next/navigation";
import { PartnerPasswordForm } from "@/components/partner/password-form";
import { isLocale } from "@/lib/i18n/config";
import { partnerCopyFor } from "@/lib/partner/copy";

export const dynamic = "force-dynamic";

export default async function PartnerPasswordPage({
  params,
}: PageProps<"/[locale]/partner/password">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const copy = partnerCopyFor(locale);
  return (
    <div className="ops-page">
      <div className="ops-page-head">
        <h1>{copy.changePassword}</h1>
      </div>
      <div className="partner-password-card">
        <PartnerPasswordForm locale={locale} copy={copy} mode="optional" />
      </div>
    </div>
  );
}
