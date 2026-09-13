"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookingSelect } from "@/components/booking/booking-select";
import { CheckoutInfoDialog } from "@/components/booking/checkout-info-dialog";
import { DateTimeField, type DateTimeFieldHandle } from "@/components/booking/date-time-field";
import { LocationField } from "@/components/booking/location-field";
import {
  AirplaneIcon,
  CalendarIcon,
  MapPinnedIcon,
  MeetAndGreetIcon,
  RoutePointBadge,
} from "@/components/booking/place-icons";
import { tourOptions } from "@/lib/booking/catalog";
import { bookingCopy } from "@/lib/booking/copy";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import { bosphorusDinnerCopy } from "@/lib/booking/bosphorus-dinner-copy";
import {
  type BookingDraftView,
  hasUnappliedTripChanges,
} from "@/lib/booking/draft-view";
import {
  formatIstanbulLocalDisplay,
  type IstanbulClock,
} from "@/lib/booking/istanbul-time";
import {
  normalizeMeetAndGreet,
  pickupAirportCode,
} from "@/lib/booking/meet-and-greet";
import {
  normalizeFlightCode,
} from "@/lib/booking/occupancy";
import {
  BOSPHORUS_NEEDS_PARTICIPANTS_EVENT,
  BOSPHORUS_OPEN_DATE_EVENT,
  BOSPHORUS_PAX_CATEGORIES,
  BOSPHORUS_PAX_MAX,
  BOSPHORUS_UNIT_PRICE_EUR,
  bosphorusEarliestBookingLocal,
  bosphorusHasAdultPax,
  bosphorusHasBookablePax,
  bosphorusPaxLabel,
  clampBosphorusPaxAdultRule,
  emptyBosphorusPaxCounts,
  normalizeBosphorusPaxCount,
  type BosphorusPaxCategory,
  type BosphorusPaxCounts,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { type LocationValue } from "@/lib/booking/types";
import { type Locale } from "@/lib/i18n/config";
import { formatCurrencyPill } from "@/lib/booking/pricing/format-eur";
import { BOOKING_WIDE_QUERY, useMediaQuery } from "@/lib/ui/use-media-query";

type BosphorusTripPanelProps = {
  locale: Locale;
  draft: BookingDraftView;
  onDraftChange: (draft: BookingDraftView) => void;
};

async function persistSelected(body: Record<string, unknown>) {
  const response = await fetch("/api/booking/draft/selected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("selected");
  }
  return (await response.json()) as { draft: BookingDraftView };
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

export function BosphorusTripPanel({
  locale,
  draft,
  onDraftChange,
}: BosphorusTripPanelProps) {
  const copy = bookingCopy[locale];
  const pageCopy = bookingPageCopy[locale];
  const bosphorus = bosphorusDinnerCopy[locale];
  const [applying, setApplying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [tourSaving, setTourSaving] = useState(false);
  const [flightInput, setFlightInput] = useState(
    draft.selected.flightCode ?? "",
  );
  const [seenFlightCode, setSeenFlightCode] = useState(
    draft.selected.flightCode ?? "",
  );
  const [flightInputFocused, setFlightInputFocused] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [participantsError, setParticipantsError] = useState(false);
  const [outsideServiceAreaOpen, setOutsideServiceAreaOpen] = useState(false);
  const [clock, setClock] = useState<IstanbulClock | null>(null);
  const paxSectionRef = useRef<HTMLDivElement>(null);
  const datetimeFieldRef = useRef<DateTimeFieldHandle>(null);
  const flightTimerRef = useRef<number | null>(null);
  const lastFlightPersistRef = useRef<string | null>(
    draft.selected.flightCode,
  );
  const flightSaveQueueRef = useRef(Promise.resolve());
  const isWide = useMediaQuery(BOOKING_WIDE_QUERY);
  const selectedFlightCode = draft.selected.flightCode ?? "";

  if (selectedFlightCode !== seenFlightCode) {
    setSeenFlightCode(selectedFlightCode);
    const typed = normalizeFlightCode(flightInput);
    if (
      typed === selectedFlightCode ||
      (!flightInputFocused && typed === seenFlightCode)
    ) {
      setFlightInput(selectedFlightCode);
    }
  }
  const pax = draft.selected.bosphorusPax ?? emptyBosphorusPaxCounts();
  const appliedPax = draft.applied.bosphorusPax ?? emptyBosphorusPaxCounts();
  const dirty = hasUnappliedTripChanges(draft.selected, draft.applied);
  const selectedTourCode = draft.selected.tourCode ?? draft.tourCode;
  const tourName = selectedTourCode
    ? (copy.tours[selectedTourCode as keyof typeof copy.tours] ??
      copy.tourPlaceholder)
    : copy.tourPlaceholder;
  const tourChoices = useMemo(
    () =>
      tourOptions
        .filter(
          (tour) =>
            tour.behaviorType === "vehicleBooking" ||
            tour.behaviorType === "perPersonBooking",
        )
        .map((tour) => ({
          id: tour.id,
          label: copy.tours[tour.id],
        })),
    [copy.tours],
  );
  const pickup = draft.selected.pickup;
  const pickupCode = pickupAirportCode(pickup);
  const showMeetAndGreet = pickupCode === "IST" || pickupCode === "SAW";
  const meetAndGreetOn = draft.selected.meetAndGreet === true;
  const datetimeMin = clock
    ? bosphorusEarliestBookingLocal(clock.nowLocal)
    : null;
  const selectedPaxEmpty =
    pax.adultSoft === 0 &&
    pax.adultAlcohol === 0 &&
    pax.child5to9 === 0 &&
    pax.child0to4 === 0;
  const appliedPaxEmpty =
    appliedPax.adultSoft === 0 &&
    appliedPax.adultAlcohol === 0 &&
    appliedPax.child5to9 === 0 &&
    appliedPax.child0to4 === 0;
  const childrenEnabled = bosphorusHasAdultPax(pax);
  const needsParticipants = !bosphorusHasBookablePax(pax);
  const showParticipantsError =
    needsParticipants && (participantsError || !isWide);

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

  useEffect(
    () => () => {
      if (flightTimerRef.current !== null) {
        window.clearTimeout(flightTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!needsParticipants) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setParticipantsError(false);
    }
  }, [needsParticipants]);

  useEffect(() => {
    function onNeedsParticipants() {
      setParticipantsError(true);
      const target = paxSectionRef.current;
      if (!target) {
        return;
      }
      if (!window.matchMedia(BOOKING_WIDE_QUERY).matches) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    window.addEventListener(BOSPHORUS_NEEDS_PARTICIPANTS_EVENT, onNeedsParticipants);
    return () => {
      window.removeEventListener(
        BOSPHORUS_NEEDS_PARTICIPANTS_EVENT,
        onNeedsParticipants,
      );
    };
  }, []);

  useEffect(() => {
    function onOpenDate() {
      void refreshClock().then(() => {
        datetimeFieldRef.current?.openPicker();
      });
    }
    window.addEventListener(BOSPHORUS_OPEN_DATE_EVENT, onOpenDate);
    return () => {
      window.removeEventListener(BOSPHORUS_OPEN_DATE_EVENT, onOpenDate);
    };
  }, [refreshClock]);

  async function changePax(category: BosphorusPaxCategory, next: number) {
    const adultsSelected =
      (category === "adultSoft" ? next : pax.adultSoft) +
        (category === "adultAlcohol" ? next : pax.adultAlcohol) >
      0;
    if (
      (category === "child5to9" || category === "child0to4") &&
      !adultsSelected &&
      next > 0
    ) {
      return;
    }
    const counts: BosphorusPaxCounts = clampBosphorusPaxAdultRule({
      ...pax,
      [category]: normalizeBosphorusPaxCount(next),
    });
    onDraftChange({
      ...draft,
      selected: { ...draft.selected, bosphorusPax: counts },
    });
    setPersistError(null);
    try {
      const payload = await persistSelected({
        locale,
        bosphorusAdultSoft: counts.adultSoft,
        bosphorusAdultAlcohol: counts.adultAlcohol,
        bosphorusChild5to9: counts.child5to9,
        bosphorusChild0to4: counts.child0to4,
      });
      onDraftChange(payload.draft);
    } catch {
      setPersistError(copy.persistError);
    }
  }

  function changeMeetAndGreet(next: boolean) {
    const normalized = normalizeMeetAndGreet(pickup, next);
    onDraftChange({
      ...draft,
      selected: { ...draft.selected, meetAndGreet: normalized },
    });
    setPersistError(null);
    void persistSelected({ locale, meetAndGreet: normalized }).then(
      (payload) => onDraftChange(payload.draft),
      () => setPersistError(copy.persistError),
    );
  }

  function previewSelectedFlight(raw: string) {
    const normalized = normalizeFlightCode(raw);
    const flightCode = normalized.length > 0 ? normalized : null;
    if ((draft.selected.flightCode ?? null) === flightCode) {
      return;
    }
    onDraftChange({
      ...draft,
      selected: { ...draft.selected, flightCode },
    });
  }

  function persistFlight(raw: string, syncInput = false) {
    const normalized = normalizeFlightCode(raw);
    if (syncInput) {
      setFlightInput(normalized);
    }
    previewSelectedFlight(normalized);
    const flightCode = normalized.length > 0 ? normalized : null;
    if ((lastFlightPersistRef.current ?? null) === flightCode) {
      return;
    }
    lastFlightPersistRef.current = flightCode;
    flightSaveQueueRef.current = flightSaveQueueRef.current
      .then(async () => {
        const payload = await persistSelected({ locale, flightCode });
        onDraftChange(payload.draft);
      })
      .catch(() => {
        setPersistError(copy.persistError);
      });
  }

  function changeTour(next: string) {
    const previous = draft;
    onDraftChange({
      ...draft,
      selected: { ...draft.selected, tourCode: next },
    });
    setPersistError(null);
    setTourSaving(true);
    void persistSelected({ locale, tourCode: next }).then(
      (payload) => onDraftChange(payload.draft),
      () => {
        onDraftChange(previous);
        setPersistError(copy.persistError);
      },
    ).finally(() => setTourSaving(false));
  }

  async function applyTrip() {
    if (applying || tourSaving || !dirty) {
      return;
    }
    setApplying(true);
    setPersistError(null);
    try {
      if (flightTimerRef.current !== null) {
        window.clearTimeout(flightTimerRef.current);
        flightTimerRef.current = null;
      }
      persistFlight(flightInput, true);
      await flightSaveQueueRef.current;
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
        setPersistError(copy.persistError);
        return;
      }
      onDraftChange(payload.draft);
      if (!window.matchMedia(BOOKING_WIDE_QUERY).matches) {
        const scrollToPackageMedia = () => {
          const target =
            document.getElementById("booking-bosphorus-media") ??
            document.getElementById("booking-bosphorus-package");
          target?.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(scrollToPackageMedia);
        });
      }
    } catch {
      setPersistError(copy.persistError);
    } finally {
      setApplying(false);
    }
  }

  async function clearPaxSelections() {
    if (clearing || applying) {
      return;
    }
    const counts = emptyBosphorusPaxCounts();
    if (
      selectedPaxEmpty &&
      appliedPaxEmpty &&
      draft.selected.meetAndGreet !== true &&
      draft.applied.meetAndGreet !== true
    ) {
      return;
    }

    setClearing(true);
    setPersistError(null);
    onDraftChange({
      ...draft,
      selected: {
        ...draft.selected,
        bosphorusPax: counts,
        meetAndGreet: false,
      },
    });
    try {
      const payload = await persistSelected({
        locale,
        bosphorusAdultSoft: 0,
        bosphorusAdultAlcohol: 0,
        bosphorusChild5to9: 0,
        bosphorusChild0to4: 0,
        meetAndGreet: false,
      });
      onDraftChange(payload.draft);
      const response = await fetch("/api/booking/draft/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const applied = (await response.json()) as {
        draft?: BookingDraftView;
      };
      if (!response.ok || !applied.draft) {
        setPersistError(copy.persistError);
        return;
      }
      onDraftChange(applied.draft);
    } catch {
      setPersistError(copy.persistError);
    } finally {
      setClearing(false);
    }
  }

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

  return (
    <div className="booking-trip-panel booking-bosphorus-panel">
      <div className="booking-trip-summary">
        <p className="booking-trip-service">{copy.services.tour}</p>

        <div className="booking-trip-datetime">
          <span className="booking-info-icon">
            <CalendarIcon className="booking-trip-stop-icon" />
          </span>
          <div className="booking-trip-datetime-copy">
            <span className="booking-trip-kicker">{copy.datetimeLabel}</span>
            <span className="booking-trip-value">
              {draft.selected.pickupAtLocal
                ? formatIstanbulLocalDisplay(
                    draft.selected.pickupAtLocal,
                    locale,
                  )
                : copy.datetimePlaceholder}
            </span>
          </div>
          <DateTimeField
            ref={datetimeFieldRef}
            id="bosphorus-trip-date"
            locale={locale}
            label={copy.datetimeLabel}
            placeholder={copy.datetimePlaceholder}
            applyLabel={copy.datetimeApply}
            hourLabel={bosphorus.lockedTimeLabel}
            minuteLabel={copy.datetimeMinute}
            value={draft.selected.pickupAtLocal}
            min={datetimeMin}
            todayDate={clock?.nowLocal.slice(0, 10) ?? null}
            error={null}
            dateOnly
            variant="icon"
            editLabel={copy.datetimeLabel}
            onPickerOpen={() => {
              void refreshClock();
            }}
            onChange={(local) => {
              onDraftChange({
                ...draft,
                selected: { ...draft.selected, pickupAtLocal: local },
              });
              void persistSelected({ locale, localDateTime: local }).then(
                (payload) => onDraftChange(payload.draft),
                () => setPersistError(copy.persistError),
              );
            }}
          />
        </div>

        <div
          className="booking-trip-route"
          aria-label={copy.pickupLabel}
        >
          <div className="booking-trip-stop">
            <span className="booking-info-icon">
              <RoutePointBadge point="A" />
            </span>
            <div className="booking-trip-stop-copy">
              <span className="booking-trip-kicker">{copy.pickupLabel}</span>
              <span className="booking-trip-value">
                {locationDisplayName(pickup, copy.airports) ||
                  copy.pickupPlaceholder}
              </span>
            </div>
            <LocationField
              id="bosphorus-pickup"
              role="pickup"
              locale={locale}
              label={copy.pickupLabel}
              title={copy.selectPickup}
              placeholder={copy.pickupPlaceholder}
              copy={locationCopy}
              value={pickup}
              variant="icon"
              editLabel={copy.selectPickup}
              requireIstanbul
              onOutsideIstanbul={() => setOutsideServiceAreaOpen(true)}
              onChange={(value) => {
                const meetAndGreet = normalizeMeetAndGreet(
                  value,
                  draft.selected.meetAndGreet,
                );
                onDraftChange({
                  ...draft,
                  selected: {
                    ...draft.selected,
                    pickup: value,
                    meetAndGreet,
                  },
                });
                void persistSelected({
                  locale,
                  pickup: value,
                  meetAndGreet,
                }).then(
                  (payload) => onDraftChange(payload.draft),
                  () => setPersistError(copy.persistError),
                );
              }}
            />
          </div>
        </div>

        <div className="booking-trip-stop">
          <span className="booking-info-icon">
            <MapPinnedIcon className="booking-trip-stop-icon" />
          </span>
          <div className="booking-trip-stop-copy">
            <span className="booking-trip-kicker">{pageCopy.tourLabel}</span>
            <span className="booking-trip-value">{tourName}</span>
          </div>
          <BookingSelect
            label={pageCopy.tourLabel}
            title={copy.tourLabel}
            placeholder={copy.tourPlaceholder}
            closeLabel={copy.closeSelector}
            value={selectedTourCode}
            options={tourChoices}
            variant="icon"
            editLabel={pageCopy.editTour}
            onChange={changeTour}
          />
        </div>

      </div>

      {showMeetAndGreet ? (
        <div className="booking-trip-extras">
          <label className="booking-extra-row booking-flight-field">
            <span className="booking-info-icon">
              <AirplaneIcon className="booking-trip-stop-icon" />
            </span>
            <span className="booking-occupancy-label">
              {pageCopy.flightCode}
            </span>
            <span className="booking-extra-control">
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                className="booking-flight-input ltr-isolate"
                dir="ltr"
                placeholder={pageCopy.flightCodePlaceholder}
                value={flightInput}
                onFocus={() => {
                  setFlightInputFocused(true);
                }}
                onChange={(event) => {
                  const next = event.target.value.toUpperCase();
                  setFlightInput(next);
                  previewSelectedFlight(next);
                  if (flightTimerRef.current !== null) {
                    window.clearTimeout(flightTimerRef.current);
                  }
                  flightTimerRef.current = window.setTimeout(() => {
                    persistFlight(next);
                  }, 400);
                }}
                onBlur={() => {
                  setFlightInputFocused(false);
                  persistFlight(flightInput, true);
                }}
              />
            </span>
          </label>
          <label className="booking-extra-row booking-switch">
            <span className="booking-info-icon">
              <MeetAndGreetIcon className="booking-trip-stop-icon" />
            </span>
            <span className="booking-occupancy-label">
              {pageCopy.meetAndGreet}
            </span>
            <span className="booking-extra-control">
              <input
                type="checkbox"
                className="booking-switch-input"
                checked={meetAndGreetOn}
                data-meet-and-greet-on={meetAndGreetOn ? "true" : "false"}
                onChange={(event) =>
                  changeMeetAndGreet(event.target.checked)
                }
              />
              <span className="booking-switch-track" aria-hidden="true" />
            </span>
          </label>
        </div>
      ) : null}

      <div
        ref={paxSectionRef}
        id="booking-bosphorus-pax"
        className="booking-trip-extras booking-bosphorus-pax"
      >
        <p className="booking-trip-kicker">{bosphorus.paxSectionLabel}</p>
        {BOSPHORUS_PAX_CATEGORIES.map((category) => {
          const isChild =
            category === "child5to9" || category === "child0to4";
          const plusDisabled =
            pax[category] >= BOSPHORUS_PAX_MAX ||
            (isChild && !childrenEnabled);
          return (
          <div key={category} className="booking-bosphorus-pax-row">
            <div className="booking-bosphorus-pax-copy">
              <span className="booking-trip-value">
                {bosphorusPaxLabel(category, locale)}
              </span>
              <span className="booking-bosphorus-pax-price">
                {BOSPHORUS_UNIT_PRICE_EUR[category] === 0
                  ? bosphorus.freeLabel
                  : formatCurrencyPill(
                      "EUR",
                      BOSPHORUS_UNIT_PRICE_EUR[category],
                      locale,
                    )}
              </span>
            </div>
            <div className="booking-bosphorus-stepper" role="group">
              <button
                type="button"
                className="booking-bosphorus-stepper-btn"
                aria-label="-"
                disabled={pax[category] <= 0}
                onClick={() => changePax(category, pax[category] - 1)}
              >
                −
              </button>
              <span className="booking-bosphorus-stepper-value" aria-live="polite">
                {pax[category]}
              </span>
              <button
                type="button"
                className="booking-bosphorus-stepper-btn"
                aria-label="+"
                disabled={plusDisabled}
                onClick={() => changePax(category, pax[category] + 1)}
              >
                +
              </button>
            </div>
          </div>
          );
        })}
      </div>

      <div className="booking-trip-actions booking-bosphorus-actions">
        <button
          type="button"
          className="booking-cta"
          disabled={applying || clearing || tourSaving || !dirty}
          onClick={() => {
            void applyTrip();
          }}
        >
          {bosphorus.applyTrip}
        </button>
        <button
          type="button"
          className="booking-cta booking-cta-secondary"
          disabled={
            applying ||
            clearing ||
            tourSaving ||
            (selectedPaxEmpty && !meetAndGreetOn)
          }
          onClick={() => {
            void clearPaxSelections();
          }}
        >
          {bosphorus.clearSelections}
        </button>
        {needsParticipants ? (
          <p
            className={`booking-bosphorus-note${showParticipantsError ? " is-error" : ""}`}
            role={showParticipantsError ? "alert" : undefined}
          >
            {bosphorus.needsParticipants}
          </p>
        ) : null}
        {persistError ? (
          <span className="booking-field-error">{persistError}</span>
        ) : null}
      </div>
      {outsideServiceAreaOpen ? (
        <CheckoutInfoDialog
          title={bosphorus.outsideServiceAreaTitle}
          body={bosphorus.outsideServiceAreaBody}
          closeLabel={bosphorus.outsideServiceAreaDismiss}
          onClose={() => setOutsideServiceAreaOpen(false)}
        />
      ) : null}
    </div>
  );
}

export function EmptyBosphorusTripPanel({ locale }: { locale: Locale }) {
  const copy = bookingCopy[locale];
  return (
    <div className="booking-trip-panel booking-trip-empty">
      <p>{copy.tourPlaceholder}</p>
    </div>
  );
}
