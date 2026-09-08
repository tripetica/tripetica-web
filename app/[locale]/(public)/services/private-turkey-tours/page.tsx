import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrivateTurkeyToursPage } from "@/components/services/private-turkey-tours-page";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { getSiteUrl, publicPageSeo } from "@/lib/seo/metadata";
import { servicePath } from "@/lib/services/catalog";
import { privateTurkeyToursCopy } from "@/lib/services/private-turkey-tours-copy";

const SERVICE_PATH = servicePath("private-turkey-tours");

type PrivateTurkeyToursRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PrivateTurkeyToursRouteProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = privateTurkeyToursCopy[locale];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    ...publicPageSeo(locale, SERVICE_PATH),
  };
}

export default async function PrivateTurkeyToursRoute({
  params,
}: PrivateTurkeyToursRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = privateTurkeyToursCopy[locale];
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
      "@type": "Country",
      name: "Türkiye",
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
      <PrivateTurkeyToursPage locale={locale} />
    </>
  );
}
