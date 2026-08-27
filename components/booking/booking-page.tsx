import { BookingWorkspace } from "@/components/booking/booking-workspace";
import { SiteHeader } from "@/components/site-header";
import { type BookingDraftView } from "@/lib/booking/draft-view";
import { bookingPath } from "@/lib/booking/page-config";
import { type Locale } from "@/lib/i18n/config";

type BookingPageProps = {
  locale: Locale;
  draft: BookingDraftView | null;
};

export function BookingPage({ locale, draft }: BookingPageProps) {
  return (
    <main className="booking-page light-theme-page">
      <SiteHeader
        locale={locale}
        variant="service"
        pathWithoutLocale={bookingPath}
        showLanguageSwitcher={false}
      />
      <div className="booking-body">
        <BookingWorkspace locale={locale} initialDraft={draft} />
      </div>
    </main>
  );
}
