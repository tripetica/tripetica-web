import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { HomeHero } from "@/components/home-hero";
import { HomeServices } from "@/components/home-services";
import { bookingCopy } from "@/lib/booking/copy";
import { loadHomepageTransferDraft } from "@/lib/booking/transfer-draft-hydration";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localeAlternates } from "@/lib/seo/metadata";
import { lightBrowserThemeColor } from "@/lib/theme";

export const viewport: Viewport = {
  themeColor: lightBrowserThemeColor,
  colorScheme: "only light",
};

const homeCopy: Record<
  Locale,
  { title: string; description: string; heading: string; heroAlt: string }
> = {
  ru: {
    title: "Tripetica — Русский",
    description: "Tripetica — русская версия сайта.",
    heading: "Tripetica — Русский",
    heroAlt: "Пассажир в премиальном автомобиле",
  },
  en: {
    title: "Tripetica — English",
    description: "Tripetica — English version of the site.",
    heading: "Tripetica — English",
    heroAlt: "Passenger in a premium car",
  },
  tr: {
    title: "Tripetica — Türkçe",
    description:
      "Tripetica — İstanbul ve Türkiye’de özel transfer, şoförlü araç ve kişiye özel seyahat hizmetleri.",
    heading: "Tripetica — Türkçe",
    heroAlt: "Premium bir otomobilde yolcu",
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

  return {
    title: copy.title,
    description: copy.description,
    alternates: localeAlternates(locale, "/"),
  };
}

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = homeCopy[locale];
  const transferDraft = await loadHomepageTransferDraft(locale);

  return (
    <main className="home-page">
      <HomeHero
        locale={locale}
        imageAlt={copy.heroAlt}
        booking={bookingCopy[locale]}
        transferDraft={transferDraft}
      />
      <HomeServices locale={locale} />
    </main>
  );
}
