"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookingPanel } from "@/components/booking/booking-panel";
import { DatetimeStaleDialog } from "@/components/booking/datetime-stale-dialog";
import { type DateTimeFieldHandle } from "@/components/booking/date-time-field";
import { ServiceSelector } from "@/components/booking/service-selector";
import { TrustBar } from "@/components/booking/trust-bar";
import { type BookingCopy } from "@/lib/booking/copy";
import { suggestedCheckoutPickupLocal } from "@/lib/booking/checkout-pickup-prep";
import { isHeroFormBasicsReady } from "@/lib/booking/hero-form-ready";
import {
  BOOKING_TIME_ZONE,
  formatIstanbulLocalDisplayLong,
  isIstanbulLocalOnOrAfter,
  type IstanbulClock,
} from "@/lib/booking/istanbul-time";
import { airportPresets, locationFromAirportPreset } from "@/lib/booking/catalog";
import { LAYOVER_TOUR_CODE } from "@/lib/booking/pricing/layover-pricing";
import {
  HALF_DAY_TOUR_CODE,
  FULL_DAY_TOUR_CODE,
} from "@/lib/booking/pricing/istanbul-address-package-tour";
import { BURSA_TOUR_CODE } from "@/lib/booking/pricing/bursa-pricing";
import {
  BOSPHORUS_DINNER_TOUR_CODE,
  bosphorusEarliestBookingLocal,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { SAPANCA_TOUR_CODE } from "@/lib/booking/pricing/sapanca-pricing";
import { isIstanbulLocationValue } from "@/lib/booking/istanbul-location";
import { layoverAirportCodeFromLocation } from "@/lib/booking/layover-airports";
import { bookingPath } from "@/lib/booking/page-config";
import { persistDraftFieldClear } from "@/lib/booking/clear-draft-field";
import {
  cloneLocation,
  locationsEqual,
  locationsRepresentSamePlace,
} from "@/lib/booking/draft-view";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { servicePath } from "@/lib/services/catalog";
import {
  emptyLocation,
  isLocationFilled,
  BOOKING_SERVICE_EVENT,
  prefillFromBookingHash,
  type BookingDateTime,
  type BookingPrefill,
  type LocationValue,
  type ServiceType,
  type TourId,
  type TransferFormHydration,
} from "@/lib/booking/types";

const PRIVATE_TURKEY_TOURS_OPTION: TourId = "private-turkey-tours";

type HeroFieldErrors = {
  pickup: boolean;
  dropoff: boolean;
  datetime: boolean;
  duration: boolean;
  tour: boolean;
};

const emptyFieldErrors = (): HeroFieldErrors => ({
  pickup: false,
  dropoff: false,
  datetime: false,
  duration: false,
  tour: false,
});

type HeroBookingProps = {
  locale: Locale;
  copy: BookingCopy;
  transferDraft?: TransferFormHydration | null;
};

export function HeroBooking({
  locale,
  copy,
  transferDraft = null,
}: HeroBookingProps) {
  const router = useRouter();
  const initialServiceType: ServiceType =
    transferDraft?.serviceType === "hourly" ||
    transferDraft?.serviceType === "tour" ||
    transferDraft?.serviceType === "transfer"
      ? transferDraft.serviceType
      : "transfer";
  const [serviceType, setServiceType] = useState<ServiceType>(initialServiceType);
  const [pickupLocation, setPickupLocation] = useState<LocationValue>(() =>
    transferDraft?.pickup ?? emptyLocation(),
  );
  const [dropoffLocation, setDropoffLocation] = useState<LocationValue | null>(
    () => transferDraft?.dropoff ?? emptyLocation(),
  );
  const [bookingDateTime, setBookingDateTime] = useState<BookingDateTime>({
    timeZone: BOOKING_TIME_ZONE,
    local: transferDraft?.pickupAtLocal ?? "",
  });
  const [durationHours, setDurationHours] = useState<number | null>(
    () =>
      initialServiceType === "hourly"
        ? (transferDraft?.durationHours ?? null)
        : null,
  );
  const [tourId, setTourId] = useState<TourId | null>(
    () => transferDraft?.tourId ?? null,
  );
  const isLayoverTour =
    serviceType === "tour" && tourId === LAYOVER_TOUR_CODE;
  const isHalfDayTour =
    serviceType === "tour" && tourId === HALF_DAY_TOUR_CODE;
  const isFullDayTour =
    serviceType === "tour" && tourId === FULL_DAY_TOUR_CODE;
  const isSapancaTour =
    serviceType === "tour" && tourId === SAPANCA_TOUR_CODE;
  const isBursaTour =
    serviceType === "tour" && tourId === BURSA_TOUR_CODE;
  const isBosphorusDinner =
    serviceType === "tour" && tourId === BOSPHORUS_DINNER_TOUR_CODE;
  const isIstanbulAddressPackageTour = isHalfDayTour || isFullDayTour;
  const isNoKmPackageTour =
    isIstanbulAddressPackageTour ||
    isSapancaTour ||
    isBursaTour ||
    isBosphorusDinner;
  const [hourlyDropoffRevealed, setHourlyDropoffRevealed] = useState(
    () =>
      (initialServiceType === "hourly" || initialServiceType === "tour") &&
      Boolean(transferDraft && isLocationFilled(transferDraft.pickup)),
  );
  const [clock, setClock] = useState<IstanbulClock | null>(null);
  const [datetimeError, setDatetimeError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<HeroFieldErrors>(emptyFieldErrors);
  const [sameLocationError, setSameLocationError] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [staleDatetimeNearest, setStaleDatetimeNearest] = useState<string | null>(
    null,
  );
  const submittingRef = useRef(false);
  const datetimeFieldRef = useRef<DateTimeFieldHandle>(null);

  const ctaLooksReady = useMemo(
    () =>
      isHeroFormBasicsReady({
        serviceType,
        pickup: pickupLocation,
        dropoff: dropoffLocation,
        durationHours,
        tourId,
        pickupAtLocal: bookingDateTime.local,
      }),
    [
      serviceType,
      pickupLocation,
      dropoffLocation,
      durationHours,
      tourId,
      bookingDateTime.local,
    ],
  );

  const refreshClock = useCallback(async () => {
    const response = await fetch("/api/booking/clock", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const next = (await response.json()) as IstanbulClock;
    setClock(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadClock() {
      const response = await fetch("/api/booking/clock", { cache: "no-store" });
      if (!response.ok || cancelled) {
        return;
      }
      const next = (await response.json()) as IstanbulClock;
      if (!cancelled) {
        setClock(next);
      }
    }

    const timer = window.setTimeout(() => {
      void loadClock();
    }, 0);
    const interval = window.setInterval(() => {
      void loadClock();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function applyPrefill(prefill: BookingPrefill) {
      setServiceType(prefill.service);
      if (prefill.tourId) {
        setTourId(prefill.tourId);
      } else if (prefill.service === "tour") {
        setTourId(null);
      }
      if (prefill.pickupAirport) {
        const preset = airportPresets.find(
          (item) => item.id === prefill.pickupAirport,
        );
        if (preset) {
          const nextPickup = locationFromAirportPreset(
            preset,
            copy.airports[preset.id],
          );
          setPickupLocation(nextPickup);
          if (prefill.service === "hourly") {
            setHourlyDropoffRevealed(true);
            setDropoffLocation(cloneLocation(nextPickup));
          } else if (
            prefill.service === "tour" &&
            (prefill.tourId === LAYOVER_TOUR_CODE ||
              prefill.tourId === HALF_DAY_TOUR_CODE ||
              prefill.tourId === FULL_DAY_TOUR_CODE ||
              prefill.tourId === SAPANCA_TOUR_CODE ||
              prefill.tourId === BURSA_TOUR_CODE)
          ) {
            setDropoffLocation(cloneLocation(nextPickup));
          }
        }
      } else if (
        prefill.service === "tour" &&
        prefill.tourId === LAYOVER_TOUR_CODE
      ) {
        setPickupLocation((current) =>
          layoverAirportCodeFromLocation(current) ? current : emptyLocation(),
        );
      }
      if (prefill.service === "hourly") {
        setHourlyDropoffRevealed(true);
      } else if (prefill.service === "tour") {
        setHourlyDropoffRevealed(Boolean(prefill.pickupAirport));
      } else {
        setHourlyDropoffRevealed(false);
      }
      if (prefill.service === "tour") {
        setBookingDateTime({ timeZone: BOOKING_TIME_ZONE, local: "" });
        setDatetimeError(null);
      }
    }

    function onBookingService(event: Event) {
      const detail = (event as CustomEvent<BookingPrefill | ServiceType>).detail;
      if (typeof detail === "string") {
        if (detail === "transfer" || detail === "hourly" || detail === "tour") {
          applyPrefill({ service: detail });
        }
        return;
      }
      if (
        detail?.service === "transfer" ||
        detail?.service === "hourly" ||
        detail?.service === "tour"
      ) {
        applyPrefill(detail);
      }
    }

    window.addEventListener(BOOKING_SERVICE_EVENT, onBookingService);
    const fromHash = prefillFromBookingHash(window.location.hash);
    if (fromHash) {
      applyPrefill(fromHash);
    }
    return () => {
      window.removeEventListener(BOOKING_SERVICE_EVENT, onBookingService);
    };
  }, [copy.airports]);

  function changeService(next: ServiceType) {
    const leavingLayover =
      serviceType === "tour" && tourId === LAYOVER_TOUR_CODE;
    setServiceType(next);
    setFieldErrors(emptyFieldErrors());
    setSameLocationError(false);
    if (next === "hourly") {
      if (isLocationFilled(pickupLocation)) {
        setHourlyDropoffRevealed(true);
        const shouldSyncDropoff =
          !isLocationFilled(dropoffLocation) ||
          locationsEqual(dropoffLocation ?? emptyLocation(), pickupLocation);
        if (shouldSyncDropoff) {
          setDropoffLocation(cloneLocation(pickupLocation));
        }
      }
      return;
    }
    if (next === "tour") {
      setHourlyDropoffRevealed(isLocationFilled(pickupLocation));
      return;
    }
    setHourlyDropoffRevealed(false);
    if (leavingLayover) {
      setDropoffLocation(emptyLocation());
      return;
    }
    if (
      isLocationFilled(dropoffLocation) &&
      locationsEqual(dropoffLocation ?? emptyLocation(), pickupLocation)
    ) {
      setDropoffLocation(emptyLocation());
    }
  }

  async function changeDatetime(local: string) {
    if (!local) {
      setDatetimeError(null);
      setFieldErrors((prev) => ({ ...prev, datetime: false }));
      setBookingDateTime({ timeZone: BOOKING_TIME_ZONE, local: "" });
      void persistDraftFieldClear(locale, "localDateTime");
      return;
    }
    const latest = clock ?? (await refreshClock());
    const floor =
      isBosphorusDinner && latest
        ? bosphorusEarliestBookingLocal(latest.nowLocal)
        : latest?.earliestLocal;
    if (latest && floor && !isIstanbulLocalOnOrAfter(local, floor)) {
      setDatetimeError(copy.datetimeTooSoon);
      setBookingDateTime({ timeZone: BOOKING_TIME_ZONE, local: "" });
      return;
    }
    setDatetimeError(null);
    setFieldErrors((prev) => ({ ...prev, datetime: false }));
    setBookingDateTime({ timeZone: BOOKING_TIME_ZONE, local });
  }

  function syncSameLocationError(
    nextPickup: LocationValue,
    nextDropoff: LocationValue | null,
  ) {
    setSameLocationError((wasSame) => {
      if (!wasSame) {
        return false;
      }
      const stillSame = locationsRepresentSamePlace(
        nextPickup,
        nextDropoff ?? emptyLocation(),
      );
      if (!stillSame) {
        setFieldErrors((prev) => ({
          ...prev,
          pickup: false,
          dropoff: false,
        }));
      }
      return stillSame;
    });
  }

  function changePickup(value: LocationValue) {
    if (
      (serviceType === "hourly" || isLayoverTour || isNoKmPackageTour) &&
      isLocationFilled(value)
    ) {
      setHourlyDropoffRevealed(true);
      const shouldSyncDropoff =
        !isLocationFilled(dropoffLocation) ||
        locationsEqual(dropoffLocation ?? emptyLocation(), pickupLocation);
      setPickupLocation(value);
      if (shouldSyncDropoff) {
        const nextDropoff = cloneLocation(value);
        setDropoffLocation(nextDropoff);
        setFieldErrors((prev) =>
          sameLocationError
            ? prev
            : { ...prev, pickup: false },
        );
        syncSameLocationError(value, nextDropoff);
      } else {
        setFieldErrors((prev) =>
          sameLocationError
            ? prev
            : { ...prev, pickup: false },
        );
        syncSameLocationError(value, dropoffLocation);
      }
      return;
    }
    if (serviceType === "tour" && !isLocationFilled(value)) {
      setHourlyDropoffRevealed(false);
    }
    setPickupLocation(value);
    if (isLocationFilled(value) && !sameLocationError) {
      setFieldErrors((prev) => ({ ...prev, pickup: false }));
    }
    syncSameLocationError(value, dropoffLocation);
    if (!isLocationFilled(value)) {
      void persistDraftFieldClear(locale, "pickup");
    }
  }

  function changeDropoff(value: LocationValue) {
    setDropoffLocation(value);
    if (isLocationFilled(value) && !sameLocationError) {
      setFieldErrors((prev) => ({ ...prev, dropoff: false }));
    }
    syncSameLocationError(pickupLocation, value);
    if (!isLocationFilled(value)) {
      void persistDraftFieldClear(locale, "dropoff");
    }
  }

  function clearDuration() {
    setDurationHours(null);
    void persistDraftFieldClear(locale, "durationHours");
  }

  async function continueBooking() {
    const nextErrors = emptyFieldErrors();
    let hasRequiredError = false;

    if (!isLocationFilled(pickupLocation)) {
      nextErrors.pickup = true;
      hasRequiredError = true;
    }

    if (serviceType === "transfer" && !isLocationFilled(dropoffLocation)) {
      nextErrors.dropoff = true;
      hasRequiredError = true;
    }

    if (serviceType === "hourly" && !durationHours) {
      nextErrors.duration = true;
      hasRequiredError = true;
    }

    if (serviceType === "tour" && !tourId) {
      nextErrors.tour = true;
      hasRequiredError = true;
    }

    if (isLayoverTour) {
      if (!layoverAirportCodeFromLocation(pickupLocation)) {
        nextErrors.pickup = true;
        hasRequiredError = true;
      }
    }

    if (isBosphorusDinner) {
      if (!isIstanbulLocationValue(pickupLocation)) {
        nextErrors.pickup = true;
        hasRequiredError = true;
      }
    }

    if (!bookingDateTime.local.trim()) {
      nextErrors.datetime = true;
      hasRequiredError = true;
    }

    if (hasRequiredError) {
      setFieldErrors(nextErrors);
      setSameLocationError(false);
      setStaleDatetimeNearest(null);
      setDatetimeError(null);
      return;
    }

    setFieldErrors(emptyFieldErrors());

    if (
      serviceType === "transfer" &&
      locationsRepresentSamePlace(
        pickupLocation,
        dropoffLocation ?? emptyLocation(),
      )
    ) {
      setFieldErrors({
        ...emptyFieldErrors(),
        pickup: true,
        dropoff: true,
      });
      setSameLocationError(true);
      setStaleDatetimeNearest(null);
      setDatetimeError(null);
      return;
    }

    setSameLocationError(false);

    const latest = await refreshClock();
    if (!latest) {
      setDatetimeError(copy.datetimeTooSoon);
      return;
    }

    // Selected datetime that no longer meets booking floor → stale modal.
    const bookingFloor = isBosphorusDinner
      ? bosphorusEarliestBookingLocal(latest.nowLocal)
      : latest.earliestLocal;
    if (!isIstanbulLocalOnOrAfter(bookingDateTime.local, bookingFloor)) {
      setDatetimeError(null);
      setStaleDatetimeNearest(
        isBosphorusDinner
          ? bookingFloor
          : suggestedCheckoutPickupLocal(latest.nowUtcMs),
      );
      return;
    }

    setDatetimeError(null);
    setStaleDatetimeNearest(null);

    if (
      serviceType !== "transfer" &&
      serviceType !== "hourly" &&
      !(
        serviceType === "tour" &&
        (tourId === LAYOVER_TOUR_CODE ||
          tourId === HALF_DAY_TOUR_CODE ||
          tourId === FULL_DAY_TOUR_CODE ||
          tourId === SAPANCA_TOUR_CODE ||
          tourId === BURSA_TOUR_CODE ||
          tourId === BOSPHORUS_DINNER_TOUR_CODE)
      )
    ) {
      return;
    }

    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setPersistError(null);
    try {
      const response = await fetch("/api/booking/transfer-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          serviceType === "hourly"
            ? {
                locale,
                serviceType: "hourly",
                pickup: pickupLocation,
                dropoff: dropoffLocation ?? emptyLocation(),
                durationHours,
                localDateTime: bookingDateTime.local,
              }
            : serviceType === "tour" &&
                (tourId === LAYOVER_TOUR_CODE ||
                  tourId === HALF_DAY_TOUR_CODE ||
                  tourId === FULL_DAY_TOUR_CODE ||
                  tourId === SAPANCA_TOUR_CODE ||
                  tourId === BURSA_TOUR_CODE ||
                  tourId === BOSPHORUS_DINNER_TOUR_CODE)
              ? {
                  locale,
                  serviceType: "tour",
                  tourId,
                  pickup: pickupLocation,
                  dropoff: dropoffLocation,
                  localDateTime: bookingDateTime.local,
                }
              : {
                  locale,
                  pickup: pickupLocation,
                  dropoff: dropoffLocation,
                  localDateTime: bookingDateTime.local,
                },
        ),
      });
      if (!response.ok) {
        console.error("[Tripetica transfer-search]", response.status);
        setPersistError(copy.persistError);
        return;
      }
      router.push(localizedPath(locale, bookingPath));
    } catch (error) {
      console.error("[Tripetica transfer-search]", error);
      setPersistError(copy.persistError);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function applyNearestDatetime() {
    const nearest = staleDatetimeNearest;
    setStaleDatetimeNearest(null);
    if (!nearest) {
      return;
    }
    await changeDatetime(nearest);
  }

  function pickOtherDatetime() {
    setStaleDatetimeNearest(null);
    void refreshClock().finally(() => {
      datetimeFieldRef.current?.openPicker();
    });
  }

  return (
    <div id="booking" className="hero-booking">
      <h1 className="hero-slogan">{copy.slogan}</h1>
      <ServiceSelector
        groupLabel={copy.servicesGroupLabel}
        labels={copy.services}
        value={serviceType}
        onChange={changeService}
      />
      <BookingPanel
        locale={locale}
        copy={copy}
        serviceType={serviceType}
        pickup={pickupLocation}
        dropoff={dropoffLocation}
        datetime={bookingDateTime.local}
        datetimeMin={
          isBosphorusDinner && clock
            ? bosphorusEarliestBookingLocal(clock.nowLocal)
            : (clock?.earliestLocal ?? null)
        }
        datetimeToday={clock?.nowLocal.slice(0, 10) ?? null}
        datetimeError={datetimeError}
        durationHours={durationHours}
        tourId={tourId}
        hourlyDropoffRevealed={hourlyDropoffRevealed}
        datetimeFieldRef={datetimeFieldRef}
        fieldErrors={fieldErrors}
        sameLocationError={
          sameLocationError ? copy.transferSameLocationError : null
        }
        onPickupChange={changePickup}
        onDropoffChange={changeDropoff}
        onDatetimeChange={(local) => {
          void changeDatetime(local);
        }}
        onDatetimeOpen={() => {
          void refreshClock();
        }}
        onDurationChange={(hours) => {
          setDurationHours(hours);
          setFieldErrors((prev) => ({ ...prev, duration: false }));
        }}
        onDurationClear={clearDuration}
        onTourChange={(id) => {
          if (id === PRIVATE_TURKEY_TOURS_OPTION) {
            router.push(
              localizedPath(locale, servicePath("private-turkey-tours")),
            );
            return;
          }
          if (
            id === LAYOVER_TOUR_CODE &&
            !layoverAirportCodeFromLocation(pickupLocation)
          ) {
            setPickupLocation(emptyLocation());
            setHourlyDropoffRevealed(false);
            setSameLocationError(false);
            setFieldErrors((prev) => ({ ...prev, pickup: false }));
          }
          setTourId(id);
          setFieldErrors((prev) => ({ ...prev, tour: false }));
        }}
        onTourClear={() => {
          setTourId(null);
          setFieldErrors((prev) => ({ ...prev, tour: false }));
          void persistDraftFieldClear(locale, "tourCode");
        }}
        onSwapLocations={() => {
          const nextPickup = dropoffLocation ?? emptyLocation();
          const nextDropoff = pickupLocation;
          setPickupLocation(nextPickup);
          setDropoffLocation(nextDropoff);
          syncSameLocationError(nextPickup, nextDropoff);
        }}
        persistError={persistError}
        submitting={submitting}
        ctaLooksReady={ctaLooksReady}
        onContinue={() => {
          void continueBooking();
        }}
      />
      <TrustBar items={copy.trust} />
      {staleDatetimeNearest ? (
        <DatetimeStaleDialog
          title={copy.datetimeStaleTitle}
          body={copy.datetimeStaleBody}
          nearestLabel={copy.datetimeStaleNearestLabel}
          nearestValue={formatIstanbulLocalDisplayLong(
            staleDatetimeNearest,
            locale,
          )}
          useNearestLabel={copy.datetimeStaleUseNearest}
          pickOtherLabel={copy.datetimeStalePickOther}
          onUseNearest={() => {
            void applyNearestDatetime();
          }}
          onPickOther={pickOtherDatetime}
          onDismiss={() => setStaleDatetimeNearest(null)}
        />
      ) : null}
    </div>
  );
}
