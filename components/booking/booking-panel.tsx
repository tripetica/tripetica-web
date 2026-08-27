"use client";

import { useState } from "react";
import { BookingSelect } from "@/components/booking/booking-select";
import { DateTimeField } from "@/components/booking/date-time-field";
import { LocationField } from "@/components/booking/location-field";
import { durationOptions, formatDurationOption, tourOptions } from "@/lib/booking/catalog";
import { type BookingCopy } from "@/lib/booking/copy";
import { type Locale } from "@/lib/i18n/config";
import {
  emptyLocation,
  isLocationFilled,
  type LocationValue,
  type ServiceType,
  type TourId,
} from "@/lib/booking/types";

type BookingPanelProps = {
  locale: Locale;
  copy: BookingCopy;
  serviceType: ServiceType;
  pickup: LocationValue;
  dropoff: LocationValue | null;
  datetime: string;
  datetimeMin: string | null;
  datetimeToday: string | null;
  datetimeError: string | null;
  durationHours: number | null;
  tourId: TourId | null;
  onPickupChange: (value: LocationValue) => void;
  onDropoffChange: (value: LocationValue) => void;
  onDatetimeChange: (value: string) => void;
  onDatetimeOpen: () => void;
  onDurationChange: (hours: number) => void;
  onTourChange: (id: TourId) => void;
  onSwapLocations: () => void;
  onContinue: () => void;
  persistError?: string | null;
  submitting?: boolean;
};

export function BookingPanel({
  locale,
  copy,
  serviceType,
  pickup,
  dropoff,
  datetime,
  datetimeMin,
  datetimeToday,
  datetimeError,
  durationHours,
  tourId,
  onPickupChange,
  onDropoffChange,
  onDatetimeChange,
  onDatetimeOpen,
  onDurationChange,
  onTourChange,
  onSwapLocations,
  onContinue,
  persistError = null,
  submitting = false,
}: BookingPanelProps) {
  const selectedTour = tourOptions.find((tour) => tour.id === tourId);
  const isCustomQuote =
    serviceType === "tour" && selectedTour?.behaviorType === "customQuote";
  const ctaLabel = isCustomQuote ? copy.ctaViewTour : copy.ctaContinue;
  const locationCopy = {
    clearLocation: copy.clearLocation,
    airportsLabel: copy.airportsLabel,
    airports: copy.airports,
    noPlaceResults: copy.noPlaceResults,
    placesError: copy.placesError,
    suggestionsLabel: copy.suggestionsLabel,
    closeSelector: copy.closeSelector,
  };

  const pickupField = (
    <LocationField
      id="pickup-location"
      role="pickup"
      locale={locale}
      label={copy.pickupLabel}
      title={copy.selectPickup}
      placeholder={copy.pickupPlaceholder}
      copy={locationCopy}
      value={pickup}
      onChange={onPickupChange}
    />
  );

  const datetimeField = (
    <DateTimeField
      id="booking-datetime"
      locale={locale}
      label={copy.datetimeLabel}
      placeholder={copy.datetimePlaceholder}
      applyLabel={copy.datetimeApply}
      hourLabel={copy.datetimeHour}
      minuteLabel={copy.datetimeMinute}
      value={datetime}
      min={datetimeMin}
      todayDate={datetimeToday}
      error={datetimeError}
      onChange={onDatetimeChange}
      onPickerOpen={onDatetimeOpen}
      clearLabel={copy.clearLocation}
    />
  );

  const middleField =
    serviceType === "hourly" ? (
      <BookingSelect
        label={copy.durationLabel}
        title={copy.selectDuration}
        placeholder={copy.durationPlaceholder}
        closeLabel={copy.closeSelector}
        value={durationHours ? String(durationHours) : null}
        options={durationOptions.map((option) => ({
          id: String(option.hours),
          label: formatDurationOption(option, locale),
        }))}
        onChange={(id) => onDurationChange(Number(id))}
      />
    ) : serviceType === "tour" ? (
      <BookingSelect
        label={copy.tourLabel}
        title={copy.tourLabel}
        placeholder={copy.tourPlaceholder}
        closeLabel={copy.closeSelector}
        value={tourId}
        options={tourOptions.map((tour) => ({
          id: tour.id,
          label: copy.tours[tour.id],
        }))}
        onChange={(id) => onTourChange(id as TourId)}
      />
    ) : (
      <LocationField
        id="dropoff-location"
        role="dropoff"
        locale={locale}
        label={copy.dropoffLabel}
        title={copy.selectDropoff}
        placeholder={copy.dropoffPlaceholder}
        copy={locationCopy}
        value={dropoff ?? emptyLocation()}
        onChange={onDropoffChange}
      />
    );

  return (
    <form
      className="booking-panel"
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      {serviceType === "transfer" ? (
        <div className="booking-route">
          {pickupField}
          <LocationSwapButton
            label={copy.swapLocations}
            onSwap={onSwapLocations}
            hideOnMobile={
              !isLocationFilled(pickup) || !isLocationFilled(dropoff)
            }
          />
          {middleField}
        </div>
      ) : (
        <>
          {pickupField}
          {middleField}
        </>
      )}
      {datetimeField}
      <button type="submit" className="booking-cta" disabled={submitting}>
        {ctaLabel}
      </button>
      {persistError ? (
        <span className="booking-field-error">{persistError}</span>
      ) : null}
    </form>
  );
}

function LocationSwapButton({
  label,
  onSwap,
  hideOnMobile,
}: {
  label: string;
  onSwap: () => void;
  hideOnMobile: boolean;
}) {
  const [swapping, setSwapping] = useState(false);

  function bindPress(element: HTMLElement, pressed: boolean) {
    if (pressed) {
      element.setAttribute("data-pressed", "true");
    } else {
      element.removeAttribute("data-pressed");
    }
  }

  return (
    <button
      type="button"
      className={`booking-swap liquid-lens glass-surface ${swapping ? "is-swapping" : ""}${hideOnMobile ? " is-mobile-hidden" : ""}`}
      aria-label={label}
      onPointerDown={(event) => bindPress(event.currentTarget, true)}
      onPointerUp={(event) => bindPress(event.currentTarget, false)}
      onPointerCancel={(event) => bindPress(event.currentTarget, false)}
      onPointerLeave={(event) => bindPress(event.currentTarget, false)}
      onClick={() => {
        onSwap();
        setSwapping(true);
      }}
      onAnimationEnd={() => setSwapping(false)}
    >
      <SwapGlyph />
    </button>
  );
}

function SwapGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="booking-swap-glyph"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.85"
    >
      <path
        className="booking-swap-glyph-y"
        d="M8 19V6.2M8 6.2 5.2 9M8 6.2 10.8 9M16 5v12.8M16 17.8 13.2 15M16 17.8 18.8 15"
      />
      <path
        className="booking-swap-glyph-x"
        d="M19 8H6.2M6.2 8 9 5.2M6.2 8 9 10.8M5 16h12.8M17.8 16 15 13.2M17.8 16 15 18.8"
      />
    </svg>
  );
}
