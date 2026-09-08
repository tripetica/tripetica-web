import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { opsCopy } from "@/lib/ops/copy";
import { noindexNofollowRobots } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]/ops">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  return {
    title: opsCopy[locale].panelName,
    robots: noindexNofollowRobots,
  };
}

export default async function OpsRootLayout({
  children,
  params,
}: LayoutProps<"/[locale]/ops">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return <div className="ops-app">{children}</div>;
}
