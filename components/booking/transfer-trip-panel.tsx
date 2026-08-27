"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTimeField } from "@/components/booking/date-time-field";
import { LocationField } from "@/components/booking/location-field";
import { OccupancySelect } from "@/components/booking/occupancy-select";
import {
  AirplaneIcon,
  BabySeatIcon,
  CalendarIcon,
  LuggageIcon,
  MeetAndGreetIcon,
  PersonIcon,
  RoutePointBadge,
} from "@/components/booking/place-icons";
import { bookingCopy } from "@/lib/booking/copy";
import {
  formatDistanceKm,
  isTripSelectionDirty,
  appliedTripFingerprint,
  type BookingDraftView,
} from "@/lib/booking/draft-view";
import {
  formatIstanbulLocalDisplay,
  isIstanbulLocalOnOrAfter,
  type IstanbulClock,
} from "@/lib/booking/istanbul-time";
import {
  BABY_SEAT_COUNT_MAX,
  BABY_SEAT_COUNT_MIN,
  BOOKING_SELECT_BLOCKED_EVENT,
  LUGGAGE_COUNT_MAX,
  LUGGAGE_COUNT_MIN,
  PASSENGER_COUNT_MAX,
  PASSENGER_COUNT_MIN,
  PASSENGER_COUNT_UNSET,
  displayBabySeatCount,
  displayLuggageCount,
  displayPassengerCount,
  isAirportPickup,
  normalizeFlightCode,
  occupancyCountsAreSet,
  occupancyNeedsNormalize,
  occupancyRange,
  normalizeOccupancyCount,
} from "@/lib/booking/occupancy";
import { type DraftClearField } from "@/lib/booking/clear-draft-field";
import { occupancyOptionLabel } from "@/lib/booking/occupancy-label";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import {
  meetAndGreetMode,
  normalizeMeetAndGreet,
} from "@/lib/booking/meet-and-greet";
import { includesFirstClassAmenities } from "@/lib/booking/pricing/vehicle-quote";
import { type LocationValue, type ServiceType, isLocationFilled } from "@/lib/booking/types";
import { type Locale } from "@/lib/i18n/config";
import { BOOKING_WIDE_QUERY } from "@/lib/ui/use-media-query";

type TransferTripPanelProps = {
  locale: Locale;
  draft: BookingDraftView;
  onDraftChange: (draft: BookingDraftView) => void;
  onAppliedVehicleScroll?: () => void;
};

export function TransferTripPanel({
  locale,
  draft,
  onDraftChange,
  onAppliedVehicleScroll,
}: TransferTripPanelProps) {
  const copy = bookingPageCopy[locale];
  const booking = bookingCopy[locale];
  const [clock, setClock] = useState<IstanbulClock | null>(null);
  const [datetimeError, setDatetimeError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [kmLoading, setKmLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [flightInput, setFlightInput] = useState(draft.selected.flightCode ?? "");
  const [seenFlightCode, setSeenFlightCode] = useState(draft.selected.flightCode ?? "");
  const [passengerValidationVisible, setPassengerValidationVisible] = useState(false);
  const applyingRef = useRef(false);
  const clearingRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const locationRevisionRef = useRef(0);
  const flightTimerRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  const appliedFingerprintRef = useRef(appliedTripFingerprint(draft.applied));
  const selectedFlightCode = draft.selected.flightCode ?? "";

  if (selectedFlightCode !== seenFlightCode) {
    setSeenFlightCode(selectedFlightCode);
    const typed = normalizeFlightCode(flightInput);
    if (typed === selectedFlightCode || typed === seenFlightCode) {
      setFlightInput(selectedFlightCode);
    }
  }

  const locationCopy = {
    clearLocation: booking.clearLocation,
    airportsLabel: booking.airportsLabel,
    airports: booking.airports,
    noPlaceResults: booking.noPlaceResults,
    placesError: booking.placesError,
    suggestionsLabel: booking.suggestionsLabel,
    closeSelector: booking.closeSelector,
  };

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
    const timer = window.setTimeout(() => {
      void (async () => {
        const response = await fetch("/api/booking/clock", { cache: "no-store" });
        if (!response.ok || cancelled) {
          return;
        }
        const next = (await response.json()) as IstanbulClock;
        if (!cancelled) {
          setClock(next);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  function adoptDraft(server: BookingDraftView, source: "persist" | "apply") {
    const serverApplied = appliedTripFingerprint(server.applied);
    if (source === "apply") {
      appliedFingerprintRef.current = serverApplied;
      draftRef.current = server;
      onDraftChange(server);
      return;
    }
    const lastApplied = appliedFingerprintRef.current;
    if (lastApplied && serverApplied !== lastApplied) {
      const merged = {
        ...server,
        applied: draftRef.current.applied,
        transferQuote: draftRef.current.transferQuote,
        vehicleQuotes: draftRef.current.vehicleQuotes,
        currency: draftRef.current.currency,
      };
      draftRef.current = merged;
      onDraftChange(merged);
      return;
    }
    draftRef.current = server;
    onDraftChange(server);
  }

  useEffect(() => {
    return () => {
      if (flightTimerRef.current !== null) {
        window.clearTimeout(flightTimerRef.current);
      }
    };
  }, []);

  const serviceType = (
    draft.serviceType === "hourly" || draft.serviceType === "tour"
      ? draft.serviceType
      : "transfer"
  ) as ServiceType;
  const serviceLabel = booking.services[serviceType];
  const pendingFlight = normalizeFlightCode(flightInput);
  const selectedForDirty = {
    ...draft.selected,
    flightCode: pendingFlight.length > 0 ? pendingFlight : null,
  };
  const dirty = isTripSelectionDirty(selectedForDirty, draft.applied);
  const busy = applying || clearing;
  const occupancySelected = occupancyCountsAreSet(
    draft.selected.passengerCount,
    draft.selected.luggageCount,
    draft.selected.babySeatCount,
  );
  const occupancyApplied = occupancyCountsAreSet(
    draft.applied.passengerCount,
    draft.applied.luggageCount,
    draft.applied.babySeatCount,
  );
  const canClearMeetAndGreet =
    meetAndGreetMode(draft.selected.pickup) !== "required" &&
    (draft.selected.meetAndGreet === true || draft.applied.meetAndGreet === true);
  const canApply =
    dirty &&
    !draft.distanceError &&
    draft.selected.distanceKm !== null &&
    !kmLoading &&
    !busy;
  const canClear =
    (occupancySelected || occupancyApplied || canClearMeetAndGreet) && !busy;

  async function persistSelectedNow(
    body: Record<string, unknown>,
    locationRevision: number | null,
  ) {
    setApplyError(null);
    const locationPatch = body.pickup !== undefined || body.dropoff !== undefined;
    if (locationPatch) {
      setKmLoading(true);
    }
    const stillCurrent = () =>
      locationRevision === null ||
      locationRevision === locationRevisionRef.current;
    try {
      const response = await fetch("/api/booking/draft/selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, ...body }),
      });
      const payload = (await response.json()) as {
        draft?: BookingDraftView;
        error?: string;
      };
      if (!stillCurrent()) {
        return false;
      }
      if (!response.ok || !payload.draft) {
        if (locationPatch) {
          onDraftChange({
            ...draftRef.current,
            selected: { ...draftRef.current.selected, distanceKm: null },
            distanceError: true,
          });
        }
        setApplyError(copy.applyError);
        return false;
      }
      adoptDraft(payload.draft, "persist");
      return true;
    } catch {
      if (!stillCurrent()) {
        return false;
      }
      if (locationPatch) {
        onDraftChange({
          ...draftRef.current,
          selected: { ...draftRef.current.selected, distanceKm: null },
          distanceError: true,
        });
      }
      setApplyError(copy.applyError);
      return false;
    } finally {
      if (stillCurrent()) {
        setKmLoading(false);
      }
    }
  }

  function persistSelected(body: Record<string, unknown>) {
    const locationRevision =
      body.pickup !== undefined || body.dropoff !== undefined
        ? locationRevisionRef.current
        : null;
    const run = saveQueueRef.current.then(() =>
      persistSelectedNow(body, locationRevision),
    );
    saveQueueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function persistClearNow(
    field: DraftClearField,
    locationRevision: number | null,
  ) {
    setApplyError(null);
    const locationPatch = field === "pickup" || field === "dropoff";
    if (locationPatch) {
      setKmLoading(true);
    }
    const stillCurrent = () =>
      locationRevision === null ||
      locationRevision === locationRevisionRef.current;
    try {
      const response = await fetch("/api/booking/draft/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, [field]: true }),
      });
      const payload = (await response.json()) as {
        draft?: BookingDraftView;
        error?: string;
      };
      if (!stillCurrent()) {
        return false;
      }
      if (!response.ok) {
        setApplyError(copy.applyError);
        return false;
      }
      if (payload.draft) {
        adoptDraft(payload.draft, "apply");
      }
      return true;
    } catch {
      if (!stillCurrent()) {
        return false;
      }
      setApplyError(copy.applyError);
      return false;
    } finally {
      if (stillCurrent() && locationPatch) {
        setKmLoading(false);
      }
    }
  }

  function persistClear(field: DraftClearField) {
    const locationRevision =
      field === "pickup" || field === "dropoff"
        ? locationRevisionRef.current
        : null;
    const run = saveQueueRef.current.then(() =>
      persistClearNow(field, locationRevision),
    );
    saveQueueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  const occupancyNormalizedRef = useRef(false);

  useEffect(() => {
    if (occupancyNormalizedRef.current) {
      return;
    }
    occupancyNormalizedRef.current = true;
    const selected = draftRef.current.selected;
    if (
      !occupancyNeedsNormalize(
        selected.passengerCount,
        selected.luggageCount,
        selected.babySeatCount,
      )
    ) {
      return;
    }
    const passengerCount = normalizeOccupancyCount(
      selected.passengerCount,
      PASSENGER_COUNT_UNSET,
      PASSENGER_COUNT_MAX,
    );
    const luggageCount = normalizeOccupancyCount(
      selected.luggageCount,
      LUGGAGE_COUNT_MIN,
      LUGGAGE_COUNT_MAX,
    );
    const babySeatCount = normalizeOccupancyCount(
      selected.babySeatCount,
      BABY_SEAT_COUNT_MIN,
      BABY_SEAT_COUNT_MAX,
    );
    const body: Record<string, unknown> = {};
    if (passengerCount !== selected.passengerCount && passengerCount !== null) {
      body.passengerCount = passengerCount;
    }
    if (luggageCount !== selected.luggageCount && luggageCount !== null) {
      body.luggageCount = luggageCount;
    }
    if (babySeatCount !== selected.babySeatCount && babySeatCount !== null) {
      body.babySeatCount = babySeatCount;
    }
    if (Object.keys(body).length > 0) {
      void persistSelected(body);
    }
    // Initial clamp of out-of-range selected occupancy only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const selected = draft.selected;
    const next = normalizeMeetAndGreet(selected.pickup, selected.meetAndGreet);
    if (next === (selected.meetAndGreet === true)) {
      return;
    }
    // Pickup identity changes can hide M&G. Do not auto-enable on mount,
    // desktop breakpoint, or a user turning the switch off.
    if (next === true) {
      return;
    }
    const updated = {
      ...draft,
      selected: { ...selected, meetAndGreet: next },
    };
    draftRef.current = updated;
    onDraftChange(updated);
    void persistSelected({ meetAndGreet: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.selected.pickup.placeId,
    draft.selected.pickup.airportCode,
    draft.selected.pickup.type,
  ]);

  async function changeDatetime(local: string) {
    if (!local) {
      setDatetimeError(null);
      const next = {
        ...draftRef.current,
        selected: { ...draftRef.current.selected, pickupAtLocal: "" },
      };
      draftRef.current = next;
      onDraftChange(next);
      await persistClear("localDateTime");
      return;
    }
    const latest = clock ?? (await refreshClock());
    if (latest && !isIstanbulLocalOnOrAfter(local, latest.earliestLocal)) {
      setDatetimeError(booking.datetimeTooSoon);
      return;
    }
    setDatetimeError(null);
    await persistSelected({ localDateTime: local });
  }

  async function changePickup(value: LocationValue) {
    locationRevisionRef.current += 1;
    const meetAndGreet = normalizeMeetAndGreet(
      value,
      draftRef.current.selected.meetAndGreet,
    );
    const next = {
      ...draftRef.current,
      selected: {
        ...draftRef.current.selected,
        pickup: value,
        distanceKm: null,
        meetAndGreet,
      },
      distanceError: false,
    };
    draftRef.current = next;
    onDraftChange(next);
    if (!isLocationFilled(value)) {
      await persistClear("pickup");
      return;
    }
    setKmLoading(true);
    await persistSelected({ pickup: value, meetAndGreet });
  }

  async function changeDropoff(value: LocationValue) {
    locationRevisionRef.current += 1;
    const next = {
      ...draftRef.current,
      selected: { ...draftRef.current.selected, dropoff: value, distanceKm: null },
      distanceError: false,
    };
    draftRef.current = next;
    onDraftChange(next);
    if (!isLocationFilled(value)) {
      await persistClear("dropoff");
      return;
    }
    setKmLoading(true);
    await persistSelected({ dropoff: value });
  }

  function changeCount(
    field: "passengerCount" | "luggageCount" | "babySeatCount",
    next: number,
  ) {
    if (field === "passengerCount" && next >= PASSENGER_COUNT_MIN) {
      setPassengerValidationVisible(false);
    }
    onDraftChange({
      ...draft,
      selected: { ...draft.selected, [field]: next },
    });
    void persistSelected({ [field]: next });
  }

  function changeMeetAndGreet(next: boolean) {
    const current = draftRef.current;
    if (
      next === false &&
      meetAndGreetMode(current.selected.pickup) === "required"
    ) {
      return;
    }
    const normalized = normalizeMeetAndGreet(current.selected.pickup, next);
    const updated = {
      ...current,
      selected: { ...current.selected, meetAndGreet: normalized },
    };
    draftRef.current = updated;
    onDraftChange(updated);
    void persistSelected({ meetAndGreet: normalized });
  }

  function persistFlight(raw: string, syncInput = false) {
    const next = normalizeFlightCode(raw);
    if (syncInput) {
      setFlightInput(next);
    }
    const current = draftRef.current.selected.flightCode ?? "";
    if (next === current) {
      return;
    }
    onDraftChange({
      ...draftRef.current,
      selected: { ...draftRef.current.selected, flightCode: next.length ? next : null },
    });
    void persistSelected({ flightCode: next.length ? next : null });
  }

  async function applySelections() {
    if (applyingRef.current || clearingRef.current) {
      return;
    }
    if (flightTimerRef.current !== null) {
      window.clearTimeout(flightTimerRef.current);
      flightTimerRef.current = null;
    }
    persistFlight(flightInput, true);
    await saveQueueRef.current;
    const latest = draftRef.current;
    const latestDirty = isTripSelectionDirty(latest.selected, latest.applied);
    if (
      !latestDirty ||
      latest.distanceError ||
      latest.selected.distanceKm === null
    ) {
      return;
    }
    applyingRef.current = true;
    setApplying(true);
    setApplyError(null);
    try {
      const response = await fetch("/api/booking/draft/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const payload = (await response.json()) as {
        draft?: BookingDraftView;
        error?: string;
      };
      if (!response.ok || !payload.draft) {
        setApplyError(copy.applyError);
        return;
      }
      adoptDraft(payload.draft, "apply");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onAppliedVehicleScroll?.();
        });
      });
    } catch {
      setApplyError(copy.applyError);
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  }

  async function clearOccupancy() {
    if (applyingRef.current || clearingRef.current) {
      return;
    }
    const current = draftRef.current;
    const nextMeetAndGreet = normalizeMeetAndGreet(
      current.selected.pickup,
      includesFirstClassAmenities(current.appliedVehicleCode ?? "") ? true : false,
    );
    const occupancyWasSet =
      occupancyCountsAreSet(
        current.selected.passengerCount,
        current.selected.luggageCount,
        current.selected.babySeatCount,
      ) ||
      occupancyCountsAreSet(
        current.applied.passengerCount,
        current.applied.luggageCount,
        current.applied.babySeatCount,
      );
    const meetAndGreetNeedsClear =
      nextMeetAndGreet === false &&
      (current.selected.meetAndGreet === true || current.applied.meetAndGreet === true);
    if (!occupancyWasSet && !meetAndGreetNeedsClear) {
      return;
    }
    clearingRef.current = true;
    setClearing(true);
    setApplyError(null);
    try {
      const next = {
        ...current,
        selected: {
          ...current.selected,
          passengerCount: null,
          luggageCount: null,
          babySeatCount: null,
          meetAndGreet: nextMeetAndGreet,
        },
        applied: {
          ...current.applied,
          passengerCount: null,
          luggageCount: null,
          babySeatCount: null,
          meetAndGreet: nextMeetAndGreet,
        },
      };
      draftRef.current = next;
      onDraftChange(next);
      const persisted = await persistSelected({
        passengerCount: null,
        luggageCount: null,
        babySeatCount: null,
        meetAndGreet: nextMeetAndGreet,
      });
      if (!persisted) {
        draftRef.current = current;
        onDraftChange(current);
        return;
      }
      const latest = draftRef.current;
      const appliedOccupancySet = occupancyCountsAreSet(
        latest.applied.passengerCount,
        latest.applied.luggageCount,
        latest.applied.babySeatCount,
      );
      const appliedMeetAndGreetNeedsSync =
        latest.applied.meetAndGreet !== nextMeetAndGreet;
      if (!appliedOccupancySet && !appliedMeetAndGreetNeedsSync) {
        return;
      }
      if (latest.distanceError || latest.selected.distanceKm === null) {
        setApplyError(copy.applyError);
        return;
      }
      const response = await fetch("/api/booking/draft/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const payload = (await response.json()) as {
        draft?: BookingDraftView;
        error?: string;
      };
      if (!response.ok || !payload.draft) {
        setApplyError(copy.applyError);
        return;
      }
      adoptDraft(payload.draft, "apply");
    } catch {
      setApplyError(copy.applyError);
    } finally {
      clearingRef.current = false;
      setClearing(false);
    }
  }

  const pickup = draft.selected.pickup;
  const dropoff = draft.selected.dropoff;
  const showAirportExtras = isAirportPickup(pickup);
  const meetMode = meetAndGreetMode(pickup);
  const meetLocked = meetMode === "required";
  const meetAndGreetOn = draft.selected.meetAndGreet === true;
  const passengerCount = displayPassengerCount(draft.selected.passengerCount);
  const passengerRequired =
    passengerValidationVisible && passengerCount <= PASSENGER_COUNT_UNSET;
  const luggageCount = displayLuggageCount(draft.selected.luggageCount);
  const babySeatCount = displayBabySeatCount(draft.selected.babySeatCount);
  const passengerOptions = useMemo(
    () =>
      occupancyRange(PASSENGER_COUNT_UNSET, PASSENGER_COUNT_MAX).map((value) => ({
        value,
        label: occupancyOptionLabel("passenger", value, locale),
      })),
    [locale],
  );
  const luggageOptions = useMemo(
    () =>
      occupancyRange(LUGGAGE_COUNT_MIN, LUGGAGE_COUNT_MAX).map((value) => ({
        value,
        label: occupancyOptionLabel("luggage", value, locale),
      })),
    [locale],
  );
  const babySeatOptions = useMemo(
    () =>
      occupancyRange(BABY_SEAT_COUNT_MIN, BABY_SEAT_COUNT_MAX).map((value) => ({
        value,
        label: occupancyOptionLabel("babySeat", value, locale),
      })),
    [locale],
  );

  useEffect(() => {
    function onSelectBlocked() {
      const count = displayPassengerCount(
        draftRef.current.selected.passengerCount,
      );
      if (count > PASSENGER_COUNT_UNSET) {
        return;
      }
      setPassengerValidationVisible(true);
      if (window.matchMedia(BOOKING_WIDE_QUERY).matches) {
        return;
      }
      const node =
        document.getElementById("booking-passenger-count") ?? panelRef.current;
      if (!node) {
        return;
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    }
    window.addEventListener(BOOKING_SELECT_BLOCKED_EVENT, onSelectBlocked);
    return () => {
      window.removeEventListener(BOOKING_SELECT_BLOCKED_EVENT, onSelectBlocked);
    };
  }, []);

  useEffect(() => {
    if (displayPassengerCount(draft.selected.passengerCount) >= PASSENGER_COUNT_MIN) {
      setPassengerValidationVisible(false);
    }
  }, [draft.selected.passengerCount]);

  return (
    <div ref={panelRef} id="booking-trip-panel" className="booking-trip-panel">
      <div className="booking-trip-summary">
        <p className="booking-trip-service">{serviceLabel}</p>

        <div className="booking-trip-datetime">
          <span className="booking-info-icon">
            <CalendarIcon className="booking-trip-stop-icon" />
          </span>
          <div className="booking-trip-datetime-copy">
            <span className="booking-trip-kicker">{booking.datetimeLabel}</span>
            <span className="booking-trip-value">
              {draft.selected.pickupAtLocal
                ? formatIstanbulLocalDisplay(draft.selected.pickupAtLocal, locale)
                : booking.datetimePlaceholder}
            </span>
          </div>
          <DateTimeField
            id="booking-panel-datetime"
            locale={locale}
            label={booking.datetimeLabel}
            placeholder={booking.datetimePlaceholder}
            applyLabel={booking.datetimeApply}
            hourLabel={booking.datetimeHour}
            minuteLabel={booking.datetimeMinute}
            value={draft.selected.pickupAtLocal}
            min={clock?.earliestLocal ?? null}
            todayDate={clock?.nowLocal.slice(0, 10) ?? null}
            error={datetimeError}
            variant="icon"
            editLabel={copy.editDateTime}
            onChange={(local) => {
              void changeDatetime(local);
            }}
            onPickerOpen={() => {
              void refreshClock();
            }}
          />
        </div>
        {datetimeError ? (
          <span className="booking-field-error">{datetimeError}</span>
        ) : null}

        <div className="booking-trip-route" aria-label={`${booking.pickupLabel}, ${booking.dropoffLabel}`}>
          <div className="booking-trip-stop">
            <span className="booking-info-icon">
              <RoutePointBadge point="A" />
            </span>
            <div className="booking-trip-stop-copy">
              <span className="booking-trip-kicker">{booking.pickupLabel}</span>
              <span className="booking-trip-value">
                {locationDisplayName(pickup, booking.airports) || booking.pickupPlaceholder}
              </span>
            </div>
            <LocationField
              id="booking-panel-pickup"
              role="pickup"
              locale={locale}
              label={booking.pickupLabel}
              title={booking.selectPickup}
              placeholder={booking.pickupPlaceholder}
              copy={locationCopy}
              value={pickup}
              variant="icon"
              editLabel={copy.editPickup}
              onChange={(value) => {
                void changePickup(value);
              }}
            />
          </div>
          <div className="booking-trip-rail" aria-hidden="true" />
          <div className="booking-trip-stop">
            <span className="booking-info-icon">
              <RoutePointBadge point="B" />
            </span>
            <div className="booking-trip-stop-copy">
              <span className="booking-trip-kicker">{booking.dropoffLabel}</span>
              <span className="booking-trip-value">
                {locationDisplayName(dropoff, booking.airports) || booking.dropoffPlaceholder}
              </span>
            </div>
            <LocationField
              id="booking-panel-dropoff"
              role="dropoff"
              locale={locale}
              label={booking.dropoffLabel}
              title={booking.selectDropoff}
              placeholder={booking.dropoffPlaceholder}
              copy={locationCopy}
              value={dropoff}
              variant="icon"
              editLabel={copy.editDropoff}
              onChange={(value) => {
                void changeDropoff(value);
              }}
            />
          </div>
        </div>

        <p className="booking-trip-distance" aria-live="polite">
          {kmLoading ? (
            copy.distanceLoading
          ) : draft.distanceError || draft.selected.distanceKm === null ? (
            copy.distanceError
          ) : (
            `${copy.estimatedDistance}: ${formatDistanceKm(draft.selected.distanceKm, locale)} km`
          )}
        </p>
      </div>

      <div className="booking-trip-extras">
        <OccupancySelect
          id="booking-passenger-count"
          icon={<PersonIcon className="booking-trip-stop-icon" />}
          label={copy.passengerCount}
          value={passengerCount}
          options={passengerOptions}
          invalid={passengerRequired}
          error={passengerRequired ? copy.passengerRequired : undefined}
          onChange={(next) => changeCount("passengerCount", next)}
        />
        <OccupancySelect
          icon={<LuggageIcon className="booking-trip-stop-icon" />}
          label={copy.luggageCount}
          value={luggageCount}
          options={luggageOptions}
          onChange={(next) => changeCount("luggageCount", next)}
        />
        <OccupancySelect
          icon={<BabySeatIcon className="booking-trip-stop-icon" />}
          label={copy.babySeatCount}
          value={babySeatCount}
          options={babySeatOptions}
          onChange={(next) => changeCount("babySeatCount", next)}
        />

        {showAirportExtras ? (
          <label className="booking-extra-row booking-flight-field">
            <span className="booking-info-icon">
              <AirplaneIcon className="booking-trip-stop-icon" />
            </span>
            <span className="booking-occupancy-label">{copy.flightCode}</span>
            <span className="booking-extra-control">
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                className="booking-flight-input"
                placeholder={copy.flightCodePlaceholder}
                value={flightInput}
                onChange={(event) => {
                  const next = event.target.value.toUpperCase();
                  setFlightInput(next);
                  if (flightTimerRef.current !== null) {
                    window.clearTimeout(flightTimerRef.current);
                  }
                  flightTimerRef.current = window.setTimeout(() => {
                    persistFlight(next);
                  }, 400);
                }}
                onBlur={() => persistFlight(flightInput, true)}
              />
            </span>
          </label>
        ) : null}
        {meetMode !== "hidden" ? (
          <label
            className={`booking-extra-row booking-switch${meetLocked ? " is-locked" : ""}`}
            data-meet-and-greet-mode={meetMode}
          >
            <span className="booking-info-icon">
              <MeetAndGreetIcon className="booking-trip-stop-icon" />
            </span>
            <span className="booking-occupancy-label">{copy.meetAndGreet}</span>
            <span className="booking-extra-control">
              <input
                type="checkbox"
                className="booking-switch-input"
                checked={meetAndGreetOn}
                data-meet-and-greet-on={meetAndGreetOn ? "true" : "false"}
                disabled={meetLocked}
                onChange={(event) => changeMeetAndGreet(event.target.checked)}
              />
              <span className="booking-switch-track" aria-hidden="true" />
            </span>
          </label>
        ) : null}
      </div>

      <div className="booking-trip-actions">
        <button
          type="button"
          className="booking-cta"
          disabled={!canApply}
          aria-busy={applying}
          onClick={() => {
            void applySelections();
          }}
        >
          {applying ? copy.applyingSelections : copy.applySelections}
        </button>
        <button
          type="button"
          className="booking-cta booking-cta-secondary"
          disabled={!canClear}
          aria-busy={clearing}
          data-booking-action="clear-occupancy"
          onClick={() => {
            void clearOccupancy();
          }}
        >
          {clearing ? copy.clearingSelections : copy.clearSelections}
        </button>
      </div>
      {applyError ? <span className="booking-field-error">{applyError}</span> : null}
    </div>
  );
}

function locationDisplayName(
  value: LocationValue,
  airports: Record<"IST" | "SAW" | "AYT", string>,
) {
  if (value.airportCode === "IST" || value.airportCode === "SAW" || value.airportCode === "AYT") {
    return airports[value.airportCode];
  }
  return value.name;
}

export function EmptyTransferTripPanel({ locale }: { locale: Locale }) {
  const copy = bookingPageCopy[locale];
  return <p className="booking-trip-empty">{copy.emptyDraft}</p>;
}
