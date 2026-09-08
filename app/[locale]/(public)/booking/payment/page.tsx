import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BookingPaymentRedirect } from "@/components/booking/booking-payment-redirect";
import { SiteHeader } from "@/components/site-header";
import {
  readBookingSuccessReservationIdFromStore,
} from "@/lib/booking/booking-success-context";
import { BROWSER_SESSION_COOKIE, isBrowserSessionId } from "@/lib/booking/browser-session";
import { bookingPath } from "@/lib/booking/page-config";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { isLocale } from "@/lib/i18n/config";
import { noindexNofollowRobots } from "@/lib/seo/metadata";

type BookingPaymentRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: BookingPaymentRouteProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const copy = checkoutCopy[locale];
  return {
    title: `${copy.paymentRedirectTitle} | Tripetica`,
    description: copy.paymentRedirectBody,
    robots: noindexNofollowRobots,
  };
}

export default async function BookingPaymentRoute({
  params,
}: BookingPaymentRouteProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const cookieStore = await cookies();
  const browserSessionId = cookieStore.get(BROWSER_SESSION_COOKIE)?.value;
  const successReservationId = readBookingSuccessReservationIdFromStore((name) =>
    cookieStore.get(name)?.value,
  );

  if (!isBrowserSessionId(browserSessionId) || !successReservationId) {
    redirect(`/${locale}${bookingPath}`);
  }

  return (
    <main className="booking-page light-theme-page">
      <SiteHeader
        locale={locale}
        variant="service"
        pathWithoutLocale={bookingPath}
        showLanguageSwitcher={false}
      />
      <div className="booking-body">
        <BookingPaymentRedirect locale={locale} />
      </div>
    </main>
  );
}
