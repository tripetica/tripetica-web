import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IstanbulCityTourPage } from "@/components/services/istanbul-city-tour-page";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { getSiteUrl, publicPageSeo } from "@/lib/seo/metadata";
import { servicePath } from "@/lib/services/catalog";
import { istanbulCityTourCopy } from "@/lib/services/istanbul-city-tour-copy";

const SERVICE_PATH = servicePath("istanbul-city-tour");

type IstanbulCityTourRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: IstanbulCityTourRouteProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = istanbulCityTourCopy[locale];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    ...publicPageSeo(locale, SERVICE_PATH),
  };
}

export default async function IstanbulCityTourRoute({
  params,
}: IstanbulCityTourRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = istanbulCityTourCopy[locale];
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
      <IstanbulCityTourPage locale={locale} />
    </>
  );
}
