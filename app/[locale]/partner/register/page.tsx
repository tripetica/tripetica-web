import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PartnerRegisterForm } from "@/components/partner/register-form";
import { isLocale } from "@/lib/i18n/config";
import { partnerHomePath } from "@/lib/partner/auth";
import { partnerCopyFor } from "@/lib/partner/copy";
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
    title: partnerCopyFor(locale).registerTitle,
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
  const copy = partnerCopyFor(locale);

  return (
    <div className="ops-login">
      <div className="ops-login-card partner-register-card">
        <div className="ops-login-head">
          <p className="ops-login-brand">{copy.brand}</p>
          <h1>{copy.registerTitle}</h1>
          <p className="ops-login-lead">{copy.registerLead}</p>
        </div>
        <PartnerRegisterForm locale={locale} copy={copy} initialEmail={initialEmail} />
        <LanguageSwitcher
          appearance="panel"
          locale={locale}
          pathWithoutLocale="/partner/register"
          label={copy.language}
        />
      </div>
    </div>
  );
}
