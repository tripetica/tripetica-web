import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CheckoutSuccessGate } from "@/components/booking/checkout-success-gate";
import { SiteHeader } from "@/components/site-header";
import {
  readBookingSuccessFlowFromStore,
  readBookingSuccessReservationIdFromStore,
  resolveBookingSuccessContext,
} from "@/lib/booking/booking-success-context";
import { BROWSER_SESSION_COOKIE, isBrowserSessionId } from "@/lib/booking/browser-session";
import { bookingPath } from "@/lib/booking/page-config";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { isLocale } from "@/lib/i18n/config";
import { noindexNofollowRobots } from "@/lib/seo/metadata";

type BookingSuccessRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: BookingSuccessRouteProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const copy = checkoutCopy[locale];
  return {
    title: `${copy.successTitle} | Tripetica`,
    description: copy.successTitle,
    robots: noindexNofollowRobots,
  };
}

export default async function BookingSuccessRoute({
  params,
}: BookingSuccessRouteProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const cookieStore = await cookies();
  const browserSessionId = cookieStore.get(BROWSER_SESSION_COOKIE)?.value;
  const successReservationId = readBookingSuccessReservationIdFromStore((name) =>
    cookieStore.get(name)?.value,
  );
  const successFlow = readBookingSuccessFlowFromStore((name) =>
    cookieStore.get(name)?.value,
  );

  if (!isBrowserSessionId(browserSessionId) || !successReservationId) {
    redirect(`/${locale}${bookingPath}`);
  }

  const context = await resolveBookingSuccessContext(
    browserSessionId,
    successReservationId,
    successFlow,
  );
  if (!context) {
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
        <div className="booking-checkout is-success">
          <div className="booking-checkout-success-shell">
            <CheckoutSuccessGate
              locale={locale}
              reservationCode={context.reservationCode}
              showTourGuideInfo={context.showTourGuideInfo}
              initiallyPaid={context.paid}
              initiallyPendingPayment={context.pendingPayment}
              updatedViaEdit={context.updatedViaEdit}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
