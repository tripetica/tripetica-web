import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeHero } from "@/components/home-hero";
import { HomeServices } from "@/components/home-services";
import { bookingCopy } from "@/lib/booking/copy";
import { loadHomepageTransferDraft } from "@/lib/booking/transfer-draft-hydration";
import {
  tripeticaEmail,
  tripeticaPhoneE164,
} from "@/lib/contact/links";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  getSiteUrl,
  isProductionSeoEnvironment,
  localeAlternates,
} from "@/lib/seo/metadata";

const homeCopy: Record<
  Locale,
  {
    title: string;
    description: string;
    socialTitle: string;
    socialImage: string;
    socialImageAlt: string;
    openGraphLocale: string;
    openGraphAlternateLocales: string[];
  }
> = {
  ru: {
    title:
      "Трансферы из аэропорта, авто с водителем и частные туры в Стамбуле, Анталье и по всей Турции | Tripetica",
    description:
      "Трансферы из аэропорта, частные трансферы, автомобиль с водителем и индивидуальные туры в Стамбуле, Анталье и по всей Турции. Безопасные, комфортные и персональные решения для поездок.",
    socialTitle:
      "Tripetica | Трансферы из аэропорта, автомобиль с водителем и частные туры",
    socialImage: "/og-home-ru.jpg",
    socialImageAlt:
      "Tripetica: трансферы, автомобиль с водителем и частные туры по Турции",
    openGraphLocale: "ru_RU",
    openGraphAlternateLocales: ["en_US", "tr_TR"],
  },
  en: {
    title:
      "Airport Transfers, Chauffeur Service & Private Tours in Istanbul, Antalya & Across Türkiye | Tripetica",
    description:
      "Airport transfers, private transfers, chauffeur service and private tours in Istanbul, Antalya and across Türkiye. Safe, comfortable and personalised travel solutions.",
    socialTitle:
      "Tripetica | Airport Transfers, Chauffeur Service & Private Tours",
    socialImage: "/og-home-en.jpg",
    socialImageAlt:
      "Tripetica airport transfers, chauffeur service and private tours across Türkiye",
    openGraphLocale: "en_US",
    openGraphAlternateLocales: ["ru_RU", "tr_TR"],
  },
  tr: {
    title:
      "İstanbul, Antalya ve Türkiye Genelinde Havalimanı Transferi, Şoförlü Araç ve Özel Turlar | Tripetica",
    description:
      "İstanbul, Antalya ve Türkiye’nin her yerinde havalimanı transferi, özel transfer, şoförlü araç ve özel turlar. Güvenli, konforlu ve kişiye özel ulaşım çözümleri.",
    socialTitle:
      "Tripetica | Havalimanı Transferi, Şoförlü Araç ve Özel Turlar",
    socialImage: "/og-home-tr.jpg",
    socialImageAlt:
      "Tripetica havalimanı transferi, şoförlü araç ve Türkiye genelinde özel turlar",
    openGraphLocale: "tr_TR",
    openGraphAlternateLocales: ["ru_RU", "en_US"],
  },
};

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = homeCopy[locale];
  const pageUrl = new URL(localizedPath(locale, "/"), getSiteUrl()).toString();
  const shouldIndex = isProductionSeoEnvironment();

  return {
    title: copy.title,
    description: copy.description,
    alternates: localeAlternates(locale, "/"),
    robots: {
      index: shouldIndex,
      follow: shouldIndex,
    },
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "Tripetica",
      title: copy.socialTitle,
      description: copy.description,
      locale: copy.openGraphLocale,
      alternateLocale: copy.openGraphAlternateLocales,
      images: [
        {
          url: copy.socialImage,
          width: 1200,
          height: 630,
          alt: copy.socialImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.socialTitle,
      description: copy.description,
      images: [copy.socialImage],
    },
  };
}

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const transferDraft = await loadHomepageTransferDraft(locale);
  const organizationId = `${getSiteUrl().origin}/#organization`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Tripetica",
        legalName:
          "Search Travel Agency Turizm Taşımacılık Ticaret Limited Şirketi",
        url: getSiteUrl().origin,
        logo: new URL("/tripetica-logo-horizontal.png", getSiteUrl()).toString(),
        email: tripeticaEmail,
        telephone: tripeticaPhoneE164,
        description: homeCopy[locale].description,
        areaServed: [
          { "@type": "City", name: "Istanbul" },
          { "@type": "City", name: "Antalya" },
          { "@type": "Country", name: "Türkiye" },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${getSiteUrl().origin}/#website`,
        url: getSiteUrl().origin,
        name: "Tripetica",
        inLanguage: ["tr", "en", "ru"],
        publisher: { "@id": organizationId },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
        }}
      />
      <main className="home-page">
        <HomeHero
          locale={locale}
          booking={bookingCopy[locale]}
          transferDraft={transferDraft}
        />
        <HomeServices locale={locale} />
      </main>
    </>
  );
}
