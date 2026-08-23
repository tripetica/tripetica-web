import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SapancaTourPage } from "@/components/services/sapanca-tour-page";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { getSiteUrl, localeAlternates } from "@/lib/seo/metadata";
import { servicePath } from "@/lib/services/catalog";
import { sapancaTourCopy } from "@/lib/services/sapanca-tour-copy";

const SERVICE_PATH = servicePath("sapanca-tour");

type SapancaTourRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: SapancaTourRouteProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = sapancaTourCopy[locale];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: localeAlternates(locale, SERVICE_PATH),
  };
}

export default async function SapancaTourRoute({
  params,
}: SapancaTourRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = sapancaTourCopy[locale];
  const pageUrl = new URL(
    localizedPath(locale, SERVICE_PATH),
    getSiteUrl(),
  ).toString();

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: copy.h1,
    description: copy.metaDescription,
    provider: {
      "@type": "Organization",
      name: "Tripetica",
    },
    areaServed: {
      "@type": "Place",
      name: "Sapanca",
    },
    url: pageUrl,
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: copy.faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <SapancaTourPage locale={locale} />
    </>
  );
}
