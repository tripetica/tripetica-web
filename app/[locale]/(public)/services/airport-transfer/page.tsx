import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AirportTransferPage } from "@/components/services/airport-transfer-page";
import { isLocale } from "@/lib/i18n/config";
import { localeAlternates } from "@/lib/seo/metadata";
import { servicePath } from "@/lib/services/catalog";
import { airportTransferCopy } from "@/lib/services/airport-transfer-copy";

const SERVICE_PATH = servicePath("airport-transfer");

type AirportTransferRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: AirportTransferRouteProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = airportTransferCopy[locale];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: localeAlternates(locale, SERVICE_PATH),
  };
}

export default async function AirportTransferRoute({
  params,
}: AirportTransferRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = airportTransferCopy[locale];
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <AirportTransferPage locale={locale} />
    </>
  );
}
