"use client";

import { useState, type Ref } from "react";
import { BookingSelect } from "@/components/booking/booking-select";
import { CheckoutInfoDialog } from "@/components/booking/checkout-info-dialog";
import {
  DateTimeField,
  type DateTimeFieldHandle,
} from "@/components/booking/date-time-field";
import { LocationField } from "@/components/booking/location-field";
import { ClockIcon, MapPinnedIcon } from "@/components/booking/place-icons";
import { durationOptions, formatDurationOption, tourOptions } from "@/lib/booking/catalog";
import { LAYOVER_TOUR_CODE } from "@/lib/booking/pricing/layover-pricing";
import { SAPANCA_TOUR_CODE } from "@/lib/booking/pricing/sapanca-pricing";
import { BOSPHORUS_DINNER_TOUR_CODE } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { bosphorusDinnerCopy } from "@/lib/booking/bosphorus-dinner-copy";
import { LAYOVER_AIRPORT_CODES } from "@/lib/booking/layover-airports";
import { type BookingCopy } from "@/lib/booking/copy";
import { type Locale } from "@/lib/i18n/config";
import {
  BOOKING_DESKTOP_QUERY,
  useMediaQuery,
} from "@/lib/ui/use-media-query";
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
  hourlyDropoffRevealed?: boolean;
  datetimeFieldRef?: Ref<DateTimeFieldHandle>;
  fieldErrors?: {
    pickup?: boolean;
    dropoff?: boolean;
    datetime?: boolean;
    duration?: boolean;
    tour?: boolean;
  };
  sameLocationError?: string | null;
  onPickupChange: (value: LocationValue) => void;
  onDropoffChange: (value: LocationValue) => void;
  onDatetimeChange: (value: string) => void;
  onDatetimeOpen: () => void;
  onDurationChange: (hours: number) => void;
  onDurationClear: () => void;
  onTourChange: (id: TourId) => void;
  onTourClear: () => void;
  onSwapLocations: () => void;
  onContinue: () => void;
  ctaLooksReady?: boolean;
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
  hourlyDropoffRevealed = false,
  datetimeFieldRef,
  fieldErrors = {},
  sameLocationError = null,
  onPickupChange,
  onDropoffChange,
  onDatetimeChange,
  onDatetimeOpen,
  onDurationChange,
  onDurationClear,
  onTourChange,
  onTourClear,
  onSwapLocations,
  onContinue,
  ctaLooksReady = true,
  persistError = null,
  submitting = false,
}: BookingPanelProps) {
  const desktop = useMediaQuery(BOOKING_DESKTOP_QUERY);
  const selectedTour = tourOptions.find((tour) => tour.id === tourId);
  const isTourService = serviceType === "tour";
  const isLayoverTour =
    isTourService && tourId === LAYOVER_TOUR_CODE;
  const isSapancaTour =
    isTourService && tourId === SAPANCA_TOUR_CODE;
  const isBosphorusDinner =
    isTourService && tourId === BOSPHORUS_DINNER_TOUR_CODE;
  const [outsideServiceAreaOpen, setOutsideServiceAreaOpen] = useState(false);
  const isCustomQuote =
    isTourService &&
    selectedTour?.behaviorType === "customQuote";
  const ctaLabel = isCustomQuote ? copy.ctaViewTour : copy.ctaContinue;
  const bosphorusCopy = isBosphorusDinner
    ? bosphorusDinnerCopy[locale]
    : null;
  const bosphorusIstanbulFieldProps = isBosphorusDinner
    ? {
        requireIstanbul: true as const,
        onOutsideIstanbul: () => setOutsideServiceAreaOpen(true),
      }
    : {};
  const locationCopy = {
    clearLocation: copy.clearLocation,
    airportsLabel: copy.airportsLabel,
    airports: copy.airports,
    noPlaceResults: copy.noPlaceResults,
    placesError: copy.placesError,
    suggestionsLabel: copy.suggestionsLabel,
    closeSelector: copy.closeSelector,
    istanbulLocationRequired: copy.istanbulLocationRequired,
  };

  const layoverAirportFieldProps = {
    presetAirportCodes: LAYOVER_AIRPORT_CODES,
    airportPickerOnly: true,
  } as const;
  const tourAirportPresetProps = isTourService
    ? { presetAirportCodes: ["IST", "SAW"] as const }
    : {};

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
      invalid={Boolean(fieldErrors.pickup)}
      routePoint={
        serviceType === "transfer" ||
        serviceType === "hourly" ||
        isTourService
          ? "A"
          : undefined
      }
      className="booking-field--place"
      {...tourAirportPresetProps}
      {...(isLayoverTour ? layoverAirportFieldProps : {})}
      {...bosphorusIstanbulFieldProps}
    />
  );

  const dropoffField = (
    <LocationField
      id="dropoff-location"
      role="dropoff"
      locale={locale}
      label={
        isBosphorusDinner && bosphorusCopy
          ? bosphorusCopy.dropoffLabel
          : copy.dropoffLabel
      }
      title={
        isBosphorusDinner && bosphorusCopy
          ? bosphorusCopy.dropoffLabel
          : copy.selectDropoff
      }
      placeholder={copy.dropoffPlaceholder}
      copy={locationCopy}
      value={dropoff ?? emptyLocation()}
      onChange={onDropoffChange}
      invalid={Boolean(fieldErrors.dropoff)}
      routePoint={
        serviceType === "transfer" ||
        serviceType === "hourly" ||
        isTourService
          ? "B"
          : undefined
      }
      className="booking-field--place"
      {...(isLayoverTour ? layoverAirportFieldProps : {})}
      {...bosphorusIstanbulFieldProps}
    />
  );

  const datetimeField = (
    <div className="booking-field-slot booking-field--compact">
      <DateTimeField
        ref={datetimeFieldRef}
        id="booking-datetime"
        locale={locale}
        label={isBosphorusDinner ? copy.dateLabel : copy.datetimeLabel}
        placeholder={
          isBosphorusDinner ? copy.datePlaceholder : copy.datetimePlaceholder
        }
        applyLabel={copy.datetimeApply}
        hourLabel={copy.datetimeHour}
        minuteLabel={copy.datetimeMinute}
        value={datetime}
        min={datetimeMin}
        todayDate={datetimeToday}
        error={datetimeError}
        invalid={Boolean(fieldErrors.datetime)}
        onChange={onDatetimeChange}
        onPickerOpen={onDatetimeOpen}
        clearLabel={copy.clearLocation}
        dateOnly={isBosphorusDinner}
      />
    </div>
  );

  const durationField = (
    <BookingSelect
      label={copy.durationLabel}
      title={copy.selectDuration}
      placeholder={copy.durationPlaceholder}
      closeLabel={copy.closeSelector}
      icon={<ClockIcon className="location-icon location-icon-field" />}
      value={durationHours ? String(durationHours) : null}
      options={durationOptions.map((option) => ({
        id: String(option.hours),
        label: formatDurationOption(option, locale),
      }))}
      onChange={(id) => onDurationChange(Number(id))}
      onClear={onDurationClear}
      clearLabel={copy.clearLocation}
      invalid={Boolean(fieldErrors.duration)}
      className="booking-field--compact"
    />
  );

  const tourField = (
    <BookingSelect
      label={copy.tourLabel}
      title={copy.tourLabel}
      placeholder={copy.tourPlaceholder}
      closeLabel={copy.closeSelector}
      icon={<MapPinnedIcon className="location-icon location-icon-field" />}
      value={tourId}
      options={tourOptions.map((tour) => ({
        id: tour.id,
        label: copy.tours[tour.id],
      }))}
      onChange={(id) => onTourChange(id as TourId)}
      onClear={tourId ? onTourClear : undefined}
      clearLabel={copy.clearLocation}
      invalid={Boolean(fieldErrors.tour)}
      className="booking-field--tour flex-1"
    />
  );

  return (
    <form
      className="booking-panel"
      data-service={serviceType}
      data-layover-tour={isLayoverTour ? "true" : undefined}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      {serviceType === "transfer" ? (
        <div className="booking-route-group">
          <div className="booking-route">
            {pickupField}
            <LocationSwapButton
              label={copy.swapLocations}
              onSwap={onSwapLocations}
              hideOnMobile={
                !isLocationFilled(pickup) || !isLocationFilled(dropoff)
              }
            />
            {dropoffField}
          </div>
          {sameLocationError ? (
            <span
              className="booking-field-error booking-same-location-error"
              role="alert"
            >
              {sameLocationError}
            </span>
          ) : null}
        </div>
      ) : serviceType === "hourly" ? (
        <>
          <div className="booking-route booking-route--hourly">
            {pickupField}
          </div>
          {durationField}
        </>
      ) : (
        <div className="booking-route booking-route--tour">
          {pickupField}
          {tourField}
        </div>
      )}
      {datetimeField}
      <button
        type="submit"
        className={`booking-cta${ctaLooksReady ? "" : " is-incomplete"}`}
        disabled={submitting}
        aria-disabled={!ctaLooksReady && !submitting ? true : undefined}
      >
        {ctaLabel}
      </button>
      {persistError ? (
        <span className="booking-field-error">{persistError}</span>
      ) : null}
      {outsideServiceAreaOpen && bosphorusCopy ? (
        <CheckoutInfoDialog
          title={bosphorusCopy.outsideServiceAreaTitle}
          body={bosphorusCopy.outsideServiceAreaBody}
          closeLabel={bosphorusCopy.outsideServiceAreaDismiss}
          onClose={() => setOutsideServiceAreaOpen(false)}
        />
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
