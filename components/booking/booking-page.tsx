import { BookingWorkspace } from "@/components/booking/booking-workspace";
import { SiteHeader } from "@/components/site-header";
import { type CheckoutAccountPrefill } from "@/lib/booking/checkout-account-prefill";
import { type BookingDraftView } from "@/lib/booking/draft-view";
import {
  bookingPageConfigForDraft,
  bookingPath,
} from "@/lib/booking/page-config";
import { type Locale } from "@/lib/i18n/config";

type BookingPageProps = {
  locale: Locale;
  draft: BookingDraftView | null;
  accountPrefill?: CheckoutAccountPrefill | null;
};

export function BookingPage({
  locale,
  draft,
  accountPrefill = null,
}: BookingPageProps) {
  return (
    <main className="booking-page light-theme-page">
      <SiteHeader
        locale={locale}
        variant="service"
        pathWithoutLocale={bookingPath}
        showLanguageSwitcher={false}
      />
      <div className="booking-body">
        <BookingWorkspace
          locale={locale}
          config={bookingPageConfigForDraft(draft?.serviceType, draft?.tourCode)}
          initialDraft={draft}
          accountPrefill={accountPrefill}
        />
      </div>
    </main>
  );
}
