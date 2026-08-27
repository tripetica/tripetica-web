import {
  EmptyTransferTripPanel,
  TransferTripPanel,
} from "@/components/booking/transfer-trip-panel";
import { type BookingDraftView } from "@/lib/booking/draft-view";
import { type BookingPageConfig } from "@/lib/booking/page-config";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import { type Locale } from "@/lib/i18n/config";

type BookingSidebarProps = {
  locale: Locale;
  config: BookingPageConfig;
  draft: BookingDraftView | null;
  onDraftChange: (draft: BookingDraftView) => void;
  onAppliedVehicleScroll?: () => void;
};

export function BookingSidebar({
  locale,
  config,
  draft,
  onDraftChange,
  onAppliedVehicleScroll,
}: BookingSidebarProps) {
  const copy = bookingPageCopy[locale];

  return (
    <aside
      className="booking-sidebar glass-surface"
      aria-label={copy.sidebarLabel}
      data-booking-flow={config.flowId}
    >
      <div className="booking-sidebar-inner">
        {config.flowId === "transfer" && draft ? (
          <TransferTripPanel
            locale={locale}
            draft={draft}
            onDraftChange={onDraftChange}
            onAppliedVehicleScroll={onAppliedVehicleScroll}
          />
        ) : config.flowId === "transfer" ? (
          <EmptyTransferTripPanel locale={locale} />
        ) : (
          config.sidebarSlots.map((slot) => (
            <div
              key={slot}
              className="booking-sidebar-slot"
              data-sidebar-slot={slot}
            />
          ))
        )}
      </div>
    </aside>
  );
}
