import { type BookingPageConfig } from "@/lib/booking/page-config";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import { type Locale } from "@/lib/i18n/config";

type BookingContentProps = {
  locale: Locale;
  config: BookingPageConfig;
};

export function BookingContent({ locale, config }: BookingContentProps) {
  const copy = bookingPageCopy[locale];

  return (
    <section
      className="booking-content glass-surface"
      aria-label={copy.contentLabel}
      data-content-kind={config.contentKind}
    >
      <div className="booking-content-inner" />
    </section>
  );
}
