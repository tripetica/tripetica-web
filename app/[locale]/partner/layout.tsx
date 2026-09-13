import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { partnerCopy } from "@/lib/partner/copy";
import { noindexNofollowRobots } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]/partner">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  return {
    title: partnerCopy[asPanelLocale(locale)].panelName,
    robots: noindexNofollowRobots,
  };
}

export default async function PartnerRootLayout({
  children,
  params,
}: LayoutProps<"/[locale]/partner">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return <div className="ops-app">{children}</div>;
}
