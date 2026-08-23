"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BookingPanel } from "@/components/booking/booking-panel";
import { ServiceSelector } from "@/components/booking/service-selector";
import { TrustBar } from "@/components/booking/trust-bar";
import { type BookingCopy } from "@/lib/booking/copy";
import {
  BOOKING_TIME_ZONE,
  isIstanbulLocalOnOrAfter,
  type IstanbulClock,
} from "@/lib/booking/istanbul-time";
import { airportPresets, locationFromAirportPreset } from "@/lib/booking/catalog";
import { bookingPath } from "@/lib/booking/page-config";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
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
} from "@/lib/booking/types";

type HeroBookingProps = {
  locale: Locale;
  copy: BookingCopy;
};

export function HeroBooking({ locale, copy }: HeroBookingProps) {
  const router = useRouter();
  const [serviceType, setServiceType] = useState<ServiceType>("transfer");
  const [pickupLocation, setPickupLocation] = useState<LocationValue>(() =>
    emptyLocation(),
  );
  const [dropoffLocation, setDropoffLocation] = useState<LocationValue | null>(
    () => emptyLocation(),
  );
  const [bookingDateTime, setBookingDateTime] = useState<BookingDateTime>({
    timeZone: BOOKING_TIME_ZONE,
    local: "",
  });
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [tourId, setTourId] = useState<TourId | null>(null);
  const [clock, setClock] = useState<IstanbulClock | null>(null);
  const [datetimeError, setDatetimeError] = useState<string | null>(null);

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
          setPickupLocation(
            locationFromAirportPreset(preset, copy.airports[preset.id]),
          );
        }
      } else if (prefill.service === "tour") {
        setPickupLocation(emptyLocation());
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
    setServiceType(next);
  }

  async function changeDatetime(local: string) {
    const latest = clock ?? (await refreshClock());
    if (latest && local && !isIstanbulLocalOnOrAfter(local, latest.earliestLocal)) {
      setDatetimeError(copy.datetimeTooSoon);
      setBookingDateTime({ timeZone: BOOKING_TIME_ZONE, local: "" });
      return;
    }
    setDatetimeError(null);
    setBookingDateTime({ timeZone: BOOKING_TIME_ZONE, local });
  }

  async function continueBooking() {
    const latest = await refreshClock();
    if (
      !latest ||
      !bookingDateTime.local ||
      !isIstanbulLocalOnOrAfter(bookingDateTime.local, latest.earliestLocal)
    ) {
      setDatetimeError(copy.datetimeTooSoon);
      return;
    }
    setDatetimeError(null);

    if (serviceType !== "transfer") {
      return;
    }

    if (!isLocationFilled(pickupLocation) || !isLocationFilled(dropoffLocation)) {
      return;
    }

    router.push(localizedPath(locale, bookingPath));
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
        datetimeMin={clock?.earliestLocal ?? null}
        datetimeToday={clock?.nowLocal.slice(0, 10) ?? null}
        datetimeError={datetimeError}
        durationHours={durationHours}
        tourId={tourId}
        onPickupChange={setPickupLocation}
        onDropoffChange={setDropoffLocation}
        onDatetimeChange={(local) => {
          void changeDatetime(local);
        }}
        onDatetimeOpen={() => {
          void refreshClock();
        }}
        onDurationChange={setDurationHours}
        onTourChange={setTourId}
        onSwapLocations={() => {
          const nextPickup = dropoffLocation ?? emptyLocation();
          const nextDropoff = pickupLocation;
          setPickupLocation(nextPickup);
          setDropoffLocation(nextDropoff);
        }}
        onContinue={() => {
          void continueBooking();
        }}
      />
      <TrustBar items={copy.trust} />
    </div>
  );
}
