import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewRedirectPage } from "@/components/view/review-redirect-page";
import { isLocale } from "@/lib/i18n/config";
import { noindexFollowRobots } from "@/lib/seo/metadata";
import { reviewPageCopy } from "@/lib/view/copy";

type ReviewViewRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: ReviewViewRouteProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = reviewPageCopy[locale];

  return {
    title: `${copy.title} | Tripetica`,
    description: copy.description,
    robots: noindexFollowRobots,
  };
}

export default async function ReviewViewRoute({ params }: ReviewViewRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <ReviewRedirectPage locale={locale} />;
}
