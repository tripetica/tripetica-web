import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IstanbulLayoverPage } from "@/components/services/istanbul-layover-page";
import { isLocale } from "@/lib/i18n/config";
import { publicPageSeo } from "@/lib/seo/metadata";
import { servicePath } from "@/lib/services/catalog";
import { istanbulLayoverCopy } from "@/lib/services/istanbul-layover-copy";

const SERVICE_PATH = servicePath("istanbul-layover-tour");

type IstanbulLayoverRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: IstanbulLayoverRouteProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = istanbulLayoverCopy[locale];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    ...publicPageSeo(locale, SERVICE_PATH),
  };
}

export default async function IstanbulLayoverRoute({
  params,
}: IstanbulLayoverRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <IstanbulLayoverPage locale={locale} />;
}
