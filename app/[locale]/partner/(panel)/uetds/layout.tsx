import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { UetdsSubnav } from "@/components/ops/uetds-subnav";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";

export const dynamic = "force-dynamic";

export default async function PartnerUetdsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requirePartnerPage(locale);
  const copy = partnerCopy[asPanelLocale(locale)];
  const pathname = (await headers()).get("x-partner-pathname") ?? "";
  const pathWithoutLocale = pathname.replace(/^\/(tr|en|ru)/, "") || "/partner/uetds";

  return (
    <section className="ops-page">
      <h1>{copy.uetdsTitle}</h1>
      <UetdsSubnav
        locale={locale}
        ariaLabel={copy.uetdsTitle}
        pathWithoutLocale={pathWithoutLocale}
        items={[
          { href: "/partner/uetds/notifications/new", label: copy.uetdsNewNotification },
          { href: "/partner/uetds/notifications", label: copy.uetdsMyNotifications },
        ]}
      />
      {children}
    </section>
  );
}
