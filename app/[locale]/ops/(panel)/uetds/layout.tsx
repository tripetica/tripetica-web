import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { UetdsSubnav } from "@/components/ops/uetds-subnav";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";

export const dynamic = "force-dynamic";

export default async function OpsUetdsLayout({
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
  await requireOpsPage(locale, "uetds.view");
  const copy = opsCopy[asPanelLocale(locale)];
  const pathname = (await headers()).get("x-ops-pathname") ?? "";
  const pathWithoutLocale = pathname.replace(/^\/(tr|en|ru)/, "") || "/ops/uetds";

  return (
    <section className="ops-page">
      <h1>{copy.uetdsTitle}</h1>
      <UetdsSubnav
        locale={locale}
        ariaLabel={copy.uetdsTitle}
        pathWithoutLocale={pathWithoutLocale}
        items={[
          { href: "/ops/uetds/companies", label: copy.uetdsCompanies },
          { href: "/ops/uetds/notifications/new", label: copy.uetdsNewNotification },
          { href: "/ops/uetds/notifications", label: copy.uetdsNotifications },
          { href: "/ops/uetds/authorities", label: copy.uetdsEdevletAuthorities },
        ]}
      />
      {children}
    </section>
  );
}
