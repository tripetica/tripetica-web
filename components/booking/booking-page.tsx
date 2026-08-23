import { BookingWorkspace } from "@/components/booking/booking-workspace";
import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";

type BookingPageProps = {
  locale: Locale;
};

export function BookingPage({ locale }: BookingPageProps) {
  return (
    <main className="booking-page">
      <SiteHeader
        locale={locale}
        variant="service"
        showLanguageSwitcher={false}
      />
      <div className="booking-body">
        <BookingWorkspace locale={locale} />
      </div>
    </main>
  );
}
