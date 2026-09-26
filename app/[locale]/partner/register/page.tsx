import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OpsLanguageSwitcher } from "@/components/ops/language-switcher";
import { PartnerRegisterForm } from "@/components/partner/register-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { partnerHomePath } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { getPartnerActor } from "@/lib/partner/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/partner/register">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  return {
    title: partnerCopy[asPanelLocale(locale)].registerTitle,
    robots: { index: false, follow: false },
  };
}

export default async function PartnerRegisterPage({
  params,
  searchParams,
}: PageProps<"/[locale]/partner/register">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await getPartnerActor();
  if (actor) {
    redirect(partnerHomePath(locale, actor));
  }
  const query = await searchParams;
  const emailRaw = Array.isArray(query.email) ? query.email[0] : query.email;
  const initialEmail = emailRaw ? String(emailRaw).trim() : "";
  const copy = partnerCopy[asPanelLocale(locale)];

  return (
    <div className="ops-login">
      <div className="ops-login-card partner-register-card">
        <div className="ops-login-head">
          <p className="ops-login-brand">{copy.brand}</p>
          <h1>{copy.registerTitle}</h1>
          <p className="ops-login-lead">{copy.registerLead}</p>
        </div>
        <PartnerRegisterForm locale={locale} copy={copy} initialEmail={initialEmail} />
        <OpsLanguageSwitcher
          locale={locale}
          pathWithoutLocale="/partner/register"
          label={copy.language}
        />
      </div>
    </div>
  );
}
