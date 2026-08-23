import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BosphorusCruisePage } from "@/components/services/bosphorus-cruise-page";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { getSiteUrl, localeAlternates } from "@/lib/seo/metadata";
import { servicePath } from "@/lib/services/catalog";
import { bosphorusCruiseCopy } from "@/lib/services/bosphorus-cruise-copy";

const SERVICE_PATH = servicePath("istanbul-bosphorus-dinner-cruise");

type BosphorusCruiseRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: BosphorusCruiseRouteProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = bosphorusCruiseCopy[locale];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: localeAlternates(locale, SERVICE_PATH),
  };
}

export default async function BosphorusCruiseRoute({
  params,
}: BosphorusCruiseRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = bosphorusCruiseCopy[locale];
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
      name: "Istanbul",
    },
    url: new URL(localizedPath(locale, SERVICE_PATH), getSiteUrl()).toString(),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <BosphorusCruisePage locale={locale} />
    </>
  );
}
