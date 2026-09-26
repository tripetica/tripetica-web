import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OpsLanguageSwitcher } from "@/components/ops/language-switcher";
import { PartnerForgotPasswordForm } from "@/components/partner/forgot-password-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { partnerHomePath } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { normalizePartnerEmail } from "@/lib/partner/email";
import { getPartnerActor } from "@/lib/partner/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/partner/forgot-password">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  return {
    title: partnerCopy[asPanelLocale(locale)].forgotPasswordTitle,
    robots: { index: false, follow: false },
  };
}

export default async function PartnerForgotPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/partner/forgot-password">) {
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
  const initialEmail = emailRaw ? normalizePartnerEmail(String(emailRaw)) : "";
  const copy = partnerCopy[asPanelLocale(locale)];

  return (
    <div className="ops-login">
      <div className="ops-login-card">
        <PartnerForgotPasswordForm
          locale={locale}
          copy={copy}
          initialEmail={initialEmail}
        />
        <OpsLanguageSwitcher
          locale={locale}
          pathWithoutLocale="/partner/forgot-password"
          label={copy.language}
        />
      </div>
    </div>
  );
}
