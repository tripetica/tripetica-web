import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OpsLanguageSwitcher } from "@/components/ops/language-switcher";
import { OpsLoginForm } from "@/components/ops/login-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { firstOpsHome } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { getOpsActor } from "@/lib/ops/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/ops/login">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  return {
    title: opsCopy[asPanelLocale(locale)].panelName,
    robots: { index: false, follow: false },
  };
}

export default async function OpsLoginPage({
  params,
}: PageProps<"/[locale]/ops/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await getOpsActor();
  if (actor) {
    redirect(firstOpsHome(locale, actor));
  }
  const copy = opsCopy[asPanelLocale(locale)];

  return (
    <div className="ops-login">
      <div className="ops-login-card">
        <div className="ops-login-head">
          <p className="ops-login-brand">{copy.brand}</p>
          <h1>{copy.panelName}</h1>
          <p className="ops-login-lead">{copy.loginLead}</p>
        </div>
        <OpsLoginForm locale={locale} copy={copy} />
        <OpsLanguageSwitcher
          locale={locale}
          pathWithoutLocale="/ops/login"
          label={copy.language}
        />
      </div>
    </div>
  );
}
