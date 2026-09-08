import {
  EmptyTransferTripPanel,
  TransferTripPanel,
} from "@/components/booking/transfer-trip-panel";
import {
  BosphorusTripPanel,
  EmptyBosphorusTripPanel,
} from "@/components/booking/bosphorus-trip-panel";
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
  const vehicleFlows =
    config.flowId === "transfer" ||
    config.flowId === "hourly" ||
    config.flowId === "istanbul-layover-tour" ||
    config.flowId === "istanbul-half-day-tour" ||
    config.flowId === "istanbul-full-day-tour" ||
    config.flowId === "sapanca-tour" ||
    config.flowId === "bursa-tour";
  const bosphorusFlow = config.flowId === "bosphorus-dinner-cruise";

  return (
    <aside
      className="booking-sidebar glass-surface"
      aria-label={copy.sidebarLabel}
      data-booking-flow={config.flowId}
    >
      <div className="booking-sidebar-inner">
        {vehicleFlows && draft ? (
          <TransferTripPanel
            locale={locale}
            draft={draft}
            onDraftChange={onDraftChange}
            onAppliedVehicleScroll={onAppliedVehicleScroll}
          />
        ) : vehicleFlows ? (
          <EmptyTransferTripPanel locale={locale} />
        ) : bosphorusFlow && draft ? (
          <BosphorusTripPanel
            locale={locale}
            draft={draft}
            onDraftChange={onDraftChange}
          />
        ) : bosphorusFlow ? (
          <EmptyBosphorusTripPanel locale={locale} />
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
