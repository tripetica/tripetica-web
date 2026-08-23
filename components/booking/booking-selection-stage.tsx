import { BookingContent } from "@/components/booking/booking-content";
import { BookingSidebar } from "@/components/booking/booking-sidebar";
import { type BookingPageConfig } from "@/lib/booking/page-config";
import { type Locale } from "@/lib/i18n/config";

type BookingSelectionStageProps = {
  locale: Locale;
  config: BookingPageConfig;
};

export function BookingSelectionStage({
  locale,
  config,
}: BookingSelectionStageProps) {
  return (
    <div className="booking-selection">
      <BookingSidebar locale={locale} config={config} />
      <BookingContent locale={locale} config={config} />
    </div>
  );
}
