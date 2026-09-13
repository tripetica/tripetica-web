import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PartnerPasswordForm } from "@/components/partner/password-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPasswordChangePage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/partner/change-password">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  return {
    title: partnerCopy[asPanelLocale(locale)].setNewPassword,
    robots: { index: false, follow: false },
  };
}

export default async function PartnerForcedPasswordPage({
  params,
}: PageProps<"/[locale]/partner/change-password">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requirePartnerPasswordChangePage(locale);
  const copy = partnerCopy[asPanelLocale(locale)];

  return (
    <div className="ops-login">
      <div className="ops-login-card">
        <div className="ops-login-head">
          <p className="ops-login-brand">{copy.brand}</p>
          <h1>{copy.setNewPassword}</h1>
          <p className="ops-login-lead">{copy.setNewPasswordLead}</p>
        </div>
        <PartnerPasswordForm locale={locale} copy={copy} mode="forced" />
      </div>
    </div>
  );
}
