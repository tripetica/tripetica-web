"use client";

import { useCallback, useRef } from "react";
import { BookingContent } from "@/components/booking/booking-content";
import { BookingRouteMap } from "@/components/booking/booking-route-map";
import { BookingSidebar } from "@/components/booking/booking-sidebar";
import { type BookingDraftView } from "@/lib/booking/draft-view";
import { type BookingPageConfig } from "@/lib/booking/page-config";
import { type Locale } from "@/lib/i18n/config";
import { BOOKING_WIDE_QUERY } from "@/lib/ui/use-media-query";

type BookingSelectionStageProps = {
  locale: Locale;
  config: BookingPageConfig;
  draft: BookingDraftView | null;
  onDraftChange: (draft: BookingDraftView) => void;
  onCheckout?: () => void;
};

export function BookingSelectionStage({
  locale,
  config,
  draft,
  onDraftChange,
  onCheckout,
}: BookingSelectionStageProps) {
  const vehicleCardsRef = useRef<HTMLElement>(null);

  const scrollToVehicleCards = useCallback(() => {
    if (window.matchMedia(BOOKING_WIDE_QUERY).matches) {
      return;
    }
    const node = vehicleCardsRef.current;
    if (!node) {
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  return (
    <div
      className={`booking-selection${
        config.flowId === "bosphorus-dinner-cruise"
          ? " booking-selection--bosphorus"
          : ""
      }`}
    >
      <div className="booking-sidebar-column">
        <div className="booking-sidebar-sticky">
          <BookingSidebar
            locale={locale}
            config={config}
            draft={draft}
            onDraftChange={onDraftChange}
            onAppliedVehicleScroll={scrollToVehicleCards}
          />
          <BookingRouteMap locale={locale} draft={draft} />
        </div>
      </div>
      <BookingContent
        locale={locale}
        config={config}
        draft={draft}
        onDraftChange={onDraftChange}
        onCheckout={onCheckout}
        vehicleCardsRef={vehicleCardsRef}
      />
    </div>
  );
}
