import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BursaTourPage } from "@/components/services/bursa-tour-page";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { getSiteUrl, localeAlternates } from "@/lib/seo/metadata";
import { servicePath } from "@/lib/services/catalog";
import { bursaTourCopy } from "@/lib/services/bursa-tour-copy";

const SERVICE_PATH = servicePath("bursa-tour");

type BursaTourRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: BursaTourRouteProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = bursaTourCopy[locale];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: localeAlternates(locale, SERVICE_PATH),
  };
}

export default async function BursaTourRoute({
  params,
}: BursaTourRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = bursaTourCopy[locale];
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
      "@type": "City",
      name: "Bursa",
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
      <BursaTourPage locale={locale} />
    </>
  );
}
