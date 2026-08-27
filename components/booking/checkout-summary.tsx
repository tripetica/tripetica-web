"use client";

import { bookingCopy } from "@/lib/booking/copy";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { formatDistanceKm, type BookingDraftView } from "@/lib/booking/draft-view";
import { formatIstanbulLocalDisplay } from "@/lib/booking/istanbul-time";
import { shouldShowFlightCode } from "@/lib/booking/occupancy";
import { occupancyOptionLabel } from "@/lib/booking/occupancy-label";
import { formatCurrencyPill } from "@/lib/booking/pricing/format-eur";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import { type Locale } from "@/lib/i18n/config";

type CheckoutSummaryProps = {
  locale: Locale;
  draft: BookingDraftView;
};

export function CheckoutSummary({ locale, draft }: CheckoutSummaryProps) {
  const copy = checkoutCopy[locale];
  const booking = bookingCopy[locale];
  const page = draft.applied;
  const vehicleCopy = draft.appliedVehicleCode
    ? vehicleCardCopyFor(draft.appliedVehicleCode, locale)
    : null;
  const total =
    draft.appliedVehicleTotal !== null
      ? formatCurrencyPill(draft.currency, draft.appliedVehicleTotal, locale)
      : "—";

  const rows: { label: string; value: string; detail?: string }[] = [
    {
      label: copy.serviceType,
      value: booking.services.transfer,
    },
    {
      label: copy.vehicle,
      value: vehicleCopy?.title ?? copy.notSet,
      detail: vehicleCopy?.example,
    },
    {
      label: copy.dateTime,
      value: page.pickupAtLocal
        ? formatIstanbulLocalDisplay(page.pickupAtLocal, locale)
        : copy.notSet,
    },
    {
      label: copy.pickup,
      value: page.pickup.name || page.pickup.formattedAddress || copy.notSet,
    },
    {
      label: copy.dropoff,
      value: page.dropoff.name || page.dropoff.formattedAddress || copy.notSet,
    },
    {
      label: copy.distance,
      value:
        page.distanceKm !== null
          ? `${formatDistanceKm(page.distanceKm, locale)} ${copy.distanceUnit}`
          : copy.notSet,
    },
    {
      label: copy.passengers,
      value:
        page.passengerCount !== null
          ? occupancyOptionLabel("passenger", page.passengerCount, locale)
          : copy.notSet,
    },
    {
      label: copy.luggage,
      value:
        page.luggageCount !== null
          ? occupancyOptionLabel("luggage", page.luggageCount, locale)
          : copy.notSet,
    },
    {
      label: copy.babySeats,
      value:
        page.babySeatCount !== null
          ? occupancyOptionLabel("babySeat", page.babySeatCount, locale)
          : copy.notSet,
    },
    {
      label: copy.meetAndGreet,
      value: page.meetAndGreet === true ? copy.yes : copy.no,
    },
  ];
  if (shouldShowFlightCode(page.pickup, page.flightCode) && page.flightCode) {
    rows.push({ label: copy.flight, value: page.flightCode });
  }
  rows.push({ label: copy.currency, value: draft.currency });

  return (
    <section className="checkout-summary glass-surface" aria-labelledby="checkout-summary-title">
      <h2 id="checkout-summary-title" className="checkout-card-title">
        {copy.summaryTitle}
      </h2>
      <dl className="checkout-summary-list">
        {rows.map((row) => (
          <div key={row.label} className="checkout-summary-row">
            <dt>{row.label}</dt>
            <dd>
              <span className="checkout-summary-value">{row.value}</span>
              {row.detail ? (
                <span className="checkout-summary-detail">{row.detail}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className="checkout-summary-total">
        <span>{copy.total}</span>
        <strong>{total}</strong>
      </p>
    </section>
  );
}
