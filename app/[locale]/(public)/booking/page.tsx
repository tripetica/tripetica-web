import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingPage } from "@/components/booking/booking-page";
import { getAccountActor } from "@/lib/account/session";
import {
  accountActorToCheckoutPrefill,
} from "@/lib/booking/checkout-account-prefill";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import { loadBookingDraftView } from "@/lib/booking/transfer-draft-hydration";
import { isLocale } from "@/lib/i18n/config";
import { noindexFollowRobots } from "@/lib/seo/metadata";

type BookingRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: BookingRouteProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const copy = bookingPageCopy[locale];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    robots: noindexFollowRobots,
  };
}

export default async function BookingRoute({ params }: BookingRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const [draft, actor] = await Promise.all([
    loadBookingDraftView(locale),
    getAccountActor(),
  ]);

  return (
    <BookingPage
      locale={locale}
      draft={draft}
      accountPrefill={accountActorToCheckoutPrefill(actor)}
    />
  );
}
