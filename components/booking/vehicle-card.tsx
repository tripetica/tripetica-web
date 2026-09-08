"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  canSelectVehicle,
  hasUnappliedTripChanges,
  type BookingDraftView,
  type VehicleQuoteView,
} from "@/lib/booking/draft-view";
import {
  formatHourlyVehicleTariffRows,
  hourlyVehicleTariffCopy,
} from "@/lib/booking/catalog";
import { displayAmountFromEur } from "@/lib/booking/fx/convert";
import { normalizeMeetAndGreet } from "@/lib/booking/meet-and-greet";
import {
  BOOKING_SELECT_BLOCKED_EVENT,
  displayPassengerCount,
  PASSENGER_COUNT_UNSET,
} from "@/lib/booking/occupancy";
import { includesFirstClassAmenities } from "@/lib/booking/pricing/vehicle-quote";
import {
  DISPLAY_CURRENCIES,
  formatCurrencyPill,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import {
  BURSA_BRIDGE_ROUTE_SURCHARGE_EUR,
  BURSA_ULUDAG_ASCENT_SURCHARGE_EUR,
  hasBursaUludagAscent,
  isBursaBridgeRoute,
  isBursaTour,
} from "@/lib/booking/pricing/bursa-pricing";
import { HOURLY_SERVICE_TYPE } from "@/lib/booking/pricing/hourly-pricing";
import { isLayoverTour } from "@/lib/booking/pricing/layover-pricing";
import { isIstanbulAddressPackageTour } from "@/lib/booking/pricing/istanbul-address-package-tour";
import {
  formatLayoverPackageCoverage,
  formatPackageCoverageForTour,
  layoverVehicleTariffCopyForVehicle,
  packageTourVehicleTariffCopy,
} from "@/lib/booking/tour-display";
import { type Locale } from "@/lib/i18n/config";
import { BOOKING_WIDE_QUERY, useMediaQuery } from "@/lib/ui/use-media-query";
import {
  vehicleCardCopyFor,
  VEHICLE_GALLERY_ORDER,
  type VehicleGalleryKey,
} from "@/lib/booking/vehicles/copy";
import { vehicleImagesFor } from "@/lib/booking/vehicles/images";

type VehicleCardProps = {
  locale: Locale;
  quote: VehicleQuoteView;
  currency: DisplayCurrency;
  onDraftChange: (draft: BookingDraftView) => void;
  onCheckout?: () => void;
  draft: BookingDraftView;
};

export function VehicleCard({
  locale,
  quote,
  currency,
  onDraftChange,
  onCheckout,
  draft,
}: VehicleCardProps) {
  const copy = vehicleCardCopyFor(quote.vehicleCode, locale);
  const images = vehicleImagesFor(quote.vehicleCode);
  const desktop = useMediaQuery(BOOKING_WIDE_QUERY);
  const [active, setActive] = useState<VehicleGalleryKey>("exterior");
  const [lightbox, setLightbox] = useState(false);
  const unapplied = hasUnappliedTripChanges(draft.selected, draft.applied);
  const selectBlocked = !canSelectVehicle(draft.selected, draft.applied);
  const passengerUnset =
    displayPassengerCount(draft.selected.passengerCount) <= PASSENGER_COUNT_UNSET;
  const blockedTipCopy =
    unapplied && !passengerUnset
      ? copy.selectUnappliedDesktop
      : copy.selectBlockedDesktop;
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const persistSeq = useRef(0);
  const [blockedTip, setBlockedTip] = useState(false);
  const titleId = useId();
  const currencyGroupId = useId();
  const image = images[active];
  const lightboxOpen = desktop && lightbox;
  const heroImage = (
    <Image
      src={image.src}
      alt={copy.alt[active]}
      width={image.width}
      height={image.height}
      sizes="(max-width: 899px) 100vw, 26rem"
      quality={100}
      className="vehicle-card-hero-image"
    />
  );

  useEffect(() => {
    const media = window.matchMedia(BOOKING_WIDE_QUERY);
    function onChange() {
      if (!media.matches) {
        setLightbox(false);
      }
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) {
      return;
    }
    const trigger = mainButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setLightbox(false);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActive((current) => stepGallery(current, 1));
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActive((current) => stepGallery(current, -1));
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>("button");
      if (!nodes?.length) {
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [lightboxOpen]);

  const layover = isLayoverTour(draft.serviceType, draft.tourCode);
  const isHourly = draft.serviceType === HOURLY_SERVICE_TYPE;
  const hourlyTariffRows = isHourly
    ? formatHourlyVehicleTariffRows(
        draft.applied.durationHours,
        locale,
        quote.multiplier,
      )
    : null;
  const hourlyTariff = hourlyVehicleTariffCopy[locale];
  const packageTourTariff = packageTourVehicleTariffCopy(
    draft.tourCode,
    locale,
    quote.multiplier,
  );
  const packageTourCoverage = formatPackageCoverageForTour(
    draft.tourCode,
    locale,
    { bursaRoute: draft.applied.bursaRoute },
  );
  const layoverTariff = layoverVehicleTariffCopyForVehicle(
    locale,
    quote.multiplier,
  );
  const bursaTour = isBursaTour(draft.serviceType, draft.tourCode);
  const bursaBridgeApplied =
    bursaTour && isBursaBridgeRoute(draft.applied.bursaRoute);
  const bursaUludagApplied =
    bursaTour && hasBursaUludagAscent(draft.applied.bursaRoute);
  const feeRows = (() => {
    const transferQuote = draft.transferQuote;
    const rows = [
      { label: copy.baseFee, amount: quote.baseServiceFeeEur },
      ...(bursaBridgeApplied
        ? [
            {
              label: copy.bursaBridgeRoute,
              amount: BURSA_BRIDGE_ROUTE_SURCHARGE_EUR,
            },
          ]
        : []),
      ...(bursaUludagApplied
        ? [
            {
              label: copy.bursaUludagAscent,
              amount: BURSA_ULUDAG_ASCENT_SURCHARGE_EUR,
            },
          ]
        : []),
      { label: copy.extraPassenger, amount: quote.extraPassengerFeeEur },
      { label: copy.extraLuggage, amount: quote.extraLuggageFeeEur },
      { label: copy.babySeat, amount: quote.babySeatFeeEur },
      ...(copy.includedServices
        ? []
        : [{ label: copy.meetAndGreet, amount: quote.meetAndGreetFeeEur }]),
    ];
    return rows;
  })().map((row) => ({
    ...row,
    display: formatCurrencyPill(
      currency,
      displayAmountFromEur(row.amount, currency, quote.fxRates),
      locale,
    ),
  }));

  function selectVehicle() {
    if (selectBlocked) {
      window.dispatchEvent(new Event(BOOKING_SELECT_BLOCKED_EVENT));
      return;
    }
    const previous = {
      appliedVehicleCode: draft.appliedVehicleCode,
      appliedVehicleTotalEur: draft.appliedVehicleTotalEur,
      appliedVehicleTotal: draft.appliedVehicleTotal,
      meetAndGreet: draft.selected.meetAndGreet,
    };
    const displayTotal =
      quote.totals.find((item) => item.code === currency)?.amount ??
      displayAmountFromEur(quote.totalEur, currency, quote.fxRates);
    const enableMeetAndGreet =
      includesFirstClassAmenities(quote.vehicleCode) &&
      normalizeMeetAndGreet(draft.selected.pickup, true) &&
      draft.selected.meetAndGreet !== true;
    onDraftChange({
      ...draft,
      appliedVehicleCode: quote.vehicleCode,
      appliedVehicleTotalEur: quote.totalEur,
      appliedVehicleTotal: displayTotal,
      selected: enableMeetAndGreet
        ? { ...draft.selected, meetAndGreet: true }
        : draft.selected,
    });
    void (async () => {
      try {
        const vehicleDraft = await persistVehicle(locale, quote.vehicleCode);
        if (!vehicleDraft) {
          onDraftChange({
            ...draft,
            appliedVehicleCode: previous.appliedVehicleCode,
            appliedVehicleTotalEur: previous.appliedVehicleTotalEur,
            appliedVehicleTotal: previous.appliedVehicleTotal,
            selected: { ...draft.selected, meetAndGreet: previous.meetAndGreet },
          });
          return;
        }
        const next = {
          ...vehicleDraft,
          applied: {
            ...draft.applied,
            meetAndGreet: vehicleDraft.applied.meetAndGreet,
          },
          transferQuote: draft.transferQuote,
          vehicleQuotes:
            includesFirstClassAmenities(quote.vehicleCode) ||
            vehicleDraft.applied.meetAndGreet !== draft.applied.meetAndGreet
              ? vehicleDraft.vehicleQuotes
              : draft.vehicleQuotes,
          currency: draft.currency,
        };
        onDraftChange(next);
        onCheckout?.();
      } catch {
        onDraftChange({
          ...draft,
          appliedVehicleCode: previous.appliedVehicleCode,
          appliedVehicleTotalEur: previous.appliedVehicleTotalEur,
          appliedVehicleTotal: previous.appliedVehicleTotal,
          selected: { ...draft.selected, meetAndGreet: previous.meetAndGreet },
        });
      }
    })();
  }

  function selectCurrency(next: DisplayCurrency) {
    if (next === currency) {
      return;
    }
    const previous = currency;
    const seq = ++persistSeq.current;
    onDraftChange({ ...draft, currency: next });
    void persistCurrency(locale, next)
      .then((serverDraft) => {
        if (seq !== persistSeq.current) {
          return;
        }
        if (serverDraft) {
          onDraftChange(serverDraft);
          return;
        }
        onDraftChange({ ...draft, currency: previous });
      })
      .catch(() => {
        if (seq !== persistSeq.current) {
          return;
        }
        onDraftChange({ ...draft, currency: previous });
      });
  }

  return (
    <article
      className="vehicle-card glass-surface"
      aria-labelledby={titleId}
      data-vehicle-code={quote.vehicleCode}
      data-display-currency={currency}
      data-service-type={draft.serviceType}
    >
      <div className="vehicle-card-heading">
        <h2 id={titleId} className="vehicle-card-title">
          {copy.title}
        </h2>
        <p className="vehicle-card-example">{copy.example}</p>
      </div>

      <div className="vehicle-card-media">
        {desktop ? (
          <button
            ref={mainButtonRef}
            type="button"
            className="vehicle-card-hero is-zoomable"
            onClick={() => setLightbox(true)}
          >
            {heroImage}
          </button>
        ) : (
          <div className="vehicle-card-hero">{heroImage}</div>
        )}
        <div className="vehicle-card-thumbs" role="tablist" aria-label={copy.title}>
          {VEHICLE_GALLERY_ORDER.map((key) => {
            const thumb = images[key];
            const isActive = key === active;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`vehicle-card-thumb${isActive ? " is-active" : ""}`}
                onClick={() => setActive(key)}
              >
                <Image
                  src={thumb.src}
                  alt={copy.gallery[key]}
                  width={thumb.width}
                  height={thumb.height}
                  sizes="72px"
                  quality={100}
                  className="vehicle-card-thumb-image"
                />
              </button>
            );
          })}
        </div>
      </div>

      <dl className="vehicle-card-capacity">
        <div>
          <dt className="vehicle-card-metric-label">{copy.standardCapacityLabel}</dt>
          <dd className="vehicle-card-metric-value">{copy.standardCapacity}</dd>
        </div>
        <div>
          <dt className="vehicle-card-metric-label">{copy.maxCapacityLabel}</dt>
          <dd className="vehicle-card-metric-value">{copy.maxCapacity}</dd>
        </div>
      </dl>

      <div className="vehicle-card-details">
        <ul className="vehicle-card-fees">
          {feeRows.map((row) => (
            <li key={row.label}>
              <span className="vehicle-card-metric-label">{row.label}</span>
              <span className="vehicle-card-metric-value">
                {row.display}
              </span>
            </li>
          ))}
          {copy.includedServices ? (
            <li className="is-included">
              <span className="vehicle-card-included">{copy.includedServices}</span>
            </li>
          ) : null}
        </ul>
        <div className="vehicle-card-total">
          <p className="vehicle-card-total-label">{copy.total}</p>
          <div
            className="vehicle-card-currency-pills"
            role="radiogroup"
            aria-label={copy.currencyGroup}
          >
            {DISPLAY_CURRENCIES.map((code) => {
              const total = quote.totals.find((item) => item.code === code);
              const amount = total?.amount ?? null;
              const checked = currency === code;
              const unavailable = amount === null;
              const face = formatCurrencyPill(code, amount, locale);
              const ariaAmount = unavailable ? copy.rateUnavailable : face;
              return (
                <label
                  key={code}
                  data-currency={code}
                  className={`vehicle-card-currency-pill${checked ? " is-selected" : ""}${unavailable ? " is-unavailable" : ""}`}
                >
                  <input
                    type="radio"
                    name={currencyGroupId}
                    value={code}
                    checked={checked}
                    onChange={() => selectCurrency(code)}
                    aria-label={`${copy.currencyNames[code]}, ${ariaAmount}`}
                  />
                  <span className="vehicle-card-currency-pill-face" aria-hidden="true">
                    {face}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="vehicle-card-select-wrap">
          <button
            type="button"
            className={`vehicle-card-select${selectBlocked ? " is-blocked" : ""}`}
            aria-disabled={selectBlocked || undefined}
            aria-describedby={selectBlocked && desktop && blockedTip ? `${titleId}-select-tip` : undefined}
            onMouseEnter={() => {
              if (selectBlocked && desktop) {
                setBlockedTip(true);
              }
            }}
            onMouseLeave={() => setBlockedTip(false)}
            onFocus={() => {
              if (selectBlocked && desktop) {
                setBlockedTip(true);
              }
            }}
            onBlur={() => setBlockedTip(false)}
            onClick={() => selectVehicle()}
          >
            {copy.select}
          </button>
          {selectBlocked && desktop && blockedTip ? (
            <span id={`${titleId}-select-tip`} className="vehicle-select-tooltip" role="tooltip">
              {blockedTipCopy}
            </span>
          ) : null}
        </div>
      </div>

      {layover ? (
        <div className="vehicle-card-tariff-note" aria-label={layoverTariff.packageLabel}>
          <p>
            {layoverTariff.packageLabel}: {formatLayoverPackageCoverage(locale)}
          </p>
          <p>{layoverTariff.hourOverrun}</p>
          <p>{layoverTariff.kmOverrun}</p>
        </div>
      ) : null}
      {isHourly && hourlyTariffRows ? (
        <div
          className="vehicle-card-tariff-note"
          aria-label={hourlyTariff.packageLabel}
        >
          <p>{hourlyTariffRows.packageCoverage}</p>
          <p>{hourlyTariffRows.hourOverrun}</p>
          <p>{hourlyTariffRows.kmOverrun}</p>
          <p>{hourlyTariffRows.crossingFee}</p>
        </div>
      ) : null}
      {packageTourTariff && packageTourCoverage ? (
        <div
          className="vehicle-card-tariff-note"
          aria-label={packageTourTariff.packageLabel}
        >
          <p>
            {packageTourTariff.packageLabel}: {packageTourCoverage}
          </p>
          <p>{packageTourTariff.hourOverrun}</p>
          {packageTourTariff.kmOverrun ? (
            <p>{packageTourTariff.kmOverrun}</p>
          ) : null}
          {packageTourTariff.crossingFee ? (
            <p>{packageTourTariff.crossingFee}</p>
          ) : null}
          {packageTourTariff.bridgeRouteSurcharge && !bursaBridgeApplied ? (
            <p>{packageTourTariff.bridgeRouteSurcharge}</p>
          ) : null}
          {packageTourTariff.uludagVehicleAscent && !bursaUludagApplied ? (
            <p>{packageTourTariff.uludagVehicleAscent}</p>
          ) : null}
        </div>
      ) : null}

      {lightboxOpen
        ? createPortal(
            <div className="vehicle-lightbox" role="presentation">
              <button
                type="button"
                className="vehicle-lightbox-backdrop"
                tabIndex={-1}
                aria-label={copy.closeGallery}
                onClick={() => setLightbox(false)}
              />
              <div
                ref={dialogRef}
                className="vehicle-lightbox-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={copy.alt[active]}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  ref={closeRef}
                  type="button"
                  className="vehicle-lightbox-close"
                  aria-label={copy.closeGallery}
                  onClick={() => setLightbox(false)}
                >
                  {copy.closeGallery}
                </button>
                <div className="vehicle-lightbox-stage">
                  <Image
                    src={image.src}
                    alt={copy.alt[active]}
                    fill
                    sizes="760px"
                    quality={100}
                    priority
                    data-gallery={active}
                    className="vehicle-lightbox-image"
                  />
                </div>
                <div className="vehicle-lightbox-nav">
                  <button
                    type="button"
                    aria-label={copy.previousImage}
                    onClick={() => setActive((current) => stepGallery(current, -1))}
                  >
                    {copy.previousImage}
                  </button>
                  <button
                    type="button"
                    aria-label={copy.nextImage}
                    onClick={() => setActive((current) => stepGallery(current, 1))}
                  >
                    {copy.nextImage}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}

async function persistVehicle(
  locale: Locale,
  vehicleCode: string,
): Promise<BookingDraftView | null> {
  const response = await fetch("/api/booking/draft/vehicle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale, vehicleCode }),
  });
  const payload = (await response.json()) as {
    draft?: BookingDraftView;
  };
  if (!response.ok || !payload.draft) {
    return null;
  }
  return payload.draft;
}

async function persistCurrency(
  locale: Locale,
  currency: DisplayCurrency,
): Promise<BookingDraftView | null> {
  const response = await fetch("/api/booking/draft/selected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale, currency }),
  });
  const payload = (await response.json()) as {
    draft?: BookingDraftView;
  };
  if (!response.ok || !payload.draft) {
    return null;
  }
  return payload.draft;
}

function stepGallery(current: VehicleGalleryKey, delta: number): VehicleGalleryKey {
  const index = VEHICLE_GALLERY_ORDER.indexOf(current);
  const next = (index + delta + VEHICLE_GALLERY_ORDER.length) % VEHICLE_GALLERY_ORDER.length;
  return VEHICLE_GALLERY_ORDER[next] ?? current;
}
