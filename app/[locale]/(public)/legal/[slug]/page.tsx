import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { isLocale } from "@/lib/i18n/config";
import { publicPageSeo } from "@/lib/seo/metadata";
import {
  isLegalSlug,
  legalPath,
  legalSlugs,
} from "@/lib/legal/catalog";
import { legalDocuments } from "@/lib/legal/copy";

type LegalDocumentRouteProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return legalSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: LegalDocumentRouteProps): Promise<Metadata> {
  const { locale, slug } = await params;

  if (!isLocale(locale) || !isLegalSlug(slug)) {
    return {};
  }

  const copy = legalDocuments[locale][slug];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    ...publicPageSeo(locale, legalPath(slug)),
  };
}

export default async function LegalDocumentRoute({
  params,
}: LegalDocumentRouteProps) {
  const { locale, slug } = await params;

  if (!isLocale(locale) || !isLegalSlug(slug)) {
    notFound();
  }

  return <LegalDocumentPage locale={locale} slug={slug} />;
}
