"use client";

import { type Ref } from "react";
import { VehicleCard } from "@/components/booking/vehicle-card";
import { appliedTripFingerprint, type BookingDraftView } from "@/lib/booking/draft-view";
import { type BookingPageConfig } from "@/lib/booking/page-config";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import { type Locale } from "@/lib/i18n/config";

type BookingContentProps = {
  locale: Locale;
  config: BookingPageConfig;
  draft: BookingDraftView | null;
  onDraftChange: (draft: BookingDraftView) => void;
  onCheckout?: () => void;
  vehicleCardsRef?: Ref<HTMLElement>;
};

export function BookingContent({
  locale,
  config,
  draft,
  onDraftChange,
  onCheckout,
  vehicleCardsRef,
}: BookingContentProps) {
  const copy = bookingPageCopy[locale];
  const applied = draft?.applied;
  const fingerprint = applied ? appliedTripFingerprint(applied) : "";
  const quotes = draft?.vehicleQuotes ?? [];

  return (
    <section
      ref={vehicleCardsRef}
      id="booking-vehicle-cards"
      className={`booking-content${quotes.length > 0 ? "" : " glass-surface"}`}
      aria-label={copy.contentLabel}
      data-content-kind={config.contentKind}
      data-applied-fingerprint={fingerprint}
      data-applied-distance-km={applied?.distanceKm ?? ""}
      data-applied-pickup-at={applied?.pickupAtLocal ?? ""}
      data-applied-pickup-place={applied?.pickup.placeId ?? ""}
      data-applied-dropoff-place={applied?.dropoff.placeId ?? ""}
      data-applied-passenger-count={applied?.passengerCount ?? ""}
      data-applied-luggage-count={applied?.luggageCount ?? ""}
      data-applied-baby-seat-count={applied?.babySeatCount ?? ""}
      data-applied-meet-and-greet={applied?.meetAndGreet ?? ""}
      data-applied-flight-code={applied?.flightCode ?? ""}
      data-pricing-version={draft?.transferQuote?.pricingVersion ?? ""}
    >
      <div className="booking-content-inner">
        {quotes.length > 0 && draft
          ? quotes.map((quote) => (
              <VehicleCard
                key={`${fingerprint}-${quote.vehicleCode}`}
                locale={locale}
                quote={quote}
                currency={draft.currency}
                draft={draft}
                onDraftChange={onDraftChange}
                onCheckout={onCheckout}
              />
            ))
          : null}
      </div>
    </section>
  );
}
