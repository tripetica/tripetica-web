import { type BookingPageConfig } from "@/lib/booking/page-config";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import { type Locale } from "@/lib/i18n/config";

type BookingSidebarProps = {
  locale: Locale;
  config: BookingPageConfig;
};

export function BookingSidebar({ locale, config }: BookingSidebarProps) {
  const copy = bookingPageCopy[locale];

  return (
    <aside
      className="booking-sidebar glass-surface"
      aria-label={copy.sidebarLabel}
      data-booking-flow={config.flowId}
    >
      <div className="booking-sidebar-inner">
        {config.sidebarSlots.map((slot) => (
          <div
            key={slot}
            className="booking-sidebar-slot"
            data-sidebar-slot={slot}
          />
        ))}
      </div>
    </aside>
  );
}
