import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PartnerShell } from "@/components/partner/shell";
import { isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";

export const dynamic = "force-dynamic";

export default async function PartnerPanelLayout({
  children,
  params,
}: LayoutProps<"/[locale]/partner">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const copy = partnerCopy[locale];
  const headerList = await headers();
  const pathname = headerList.get("x-partner-pathname") ?? "";
  const pathWithoutLocale = pathname.replace(/^\/(tr|en|ru)/, "") || "/partner";

  return (
    <PartnerShell
      locale={locale}
      copy={copy}
      actor={actor}
      pathWithoutLocale={pathWithoutLocale}
    >
      {children}
    </PartnerShell>
  );
}
