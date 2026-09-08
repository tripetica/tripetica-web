import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OpsLanguageSwitcher } from "@/components/ops/language-switcher";
import { PartnerLoginForm } from "@/components/partner/login-form";
import { isLocale } from "@/lib/i18n/config";
import { partnerHomePath } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { safePartnerReturnPath } from "@/lib/partner/push/return-path";
import { getPartnerActor } from "@/lib/partner/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/partner/login">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  return {
    title: partnerCopy[locale].panelName,
    robots: { index: false, follow: false },
  };
}

export default async function PartnerLoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/partner/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const query = await searchParams;
  const nextRaw = Array.isArray(query.next) ? query.next[0] : query.next;
  const nextPath = safePartnerReturnPath(nextRaw, locale);
  const actor = await getPartnerActor();
  if (actor) {
    redirect(actor.mustChangePassword ? partnerHomePath(locale, actor) : (nextPath ?? partnerHomePath(locale, actor)));
  }
  const copy = partnerCopy[locale];

  return (
    <div className="ops-login">
      <div className="ops-login-card">
        <div className="ops-login-head">
          <p className="ops-login-brand">{copy.brand}</p>
          <h1>{copy.panelName}</h1>
          <p className="ops-login-lead">{copy.loginLead}</p>
        </div>
        <PartnerLoginForm locale={locale} copy={copy} nextPath={nextPath} />
        <OpsLanguageSwitcher
          locale={locale}
          pathWithoutLocale="/partner/login"
          label={copy.language}
        />
      </div>
    </div>
  );
}
