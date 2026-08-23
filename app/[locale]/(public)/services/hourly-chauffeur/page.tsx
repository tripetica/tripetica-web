import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HourlyChauffeurPage } from "@/components/services/hourly-chauffeur-page";
import { isLocale } from "@/lib/i18n/config";
import { localeAlternates } from "@/lib/seo/metadata";
import { servicePath } from "@/lib/services/catalog";
import { hourlyChauffeurCopy } from "@/lib/services/hourly-chauffeur-copy";

const SERVICE_PATH = servicePath("hourly-chauffeur");

type HourlyChauffeurRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: HourlyChauffeurRouteProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = hourlyChauffeurCopy[locale];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: localeAlternates(locale, SERVICE_PATH),
  };
}

export default async function HourlyChauffeurRoute({
  params,
}: HourlyChauffeurRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <HourlyChauffeurPage locale={locale} />;
}
