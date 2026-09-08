"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { bosphorusDinnerCopy } from "@/lib/booking/bosphorus-dinner-copy";
import { bookingCopy } from "@/lib/booking/copy";
import { type BookingDraftView } from "@/lib/booking/draft-view";
import { displayAmountFromEur } from "@/lib/booking/fx/convert";
import { pickupAirportCode } from "@/lib/booking/meet-and-greet";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import {
  BOSPHORUS_NEEDS_PARTICIPANTS_EVENT,
  bosphorusMeetAndGreetFeeEur,
  bosphorusHasBookablePax,
  bosphorusLineItems,
  emptyBosphorusPaxCounts,
  quoteBosphorusDinnerPackageTotalEur,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import {
  DISPLAY_CURRENCIES,
  formatCurrencyPill,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import { type Locale } from "@/lib/i18n/config";
import { BOOKING_WIDE_QUERY } from "@/lib/ui/use-media-query";

const BOSPHORUS_CARD_IMAGE = "/istanbul-bosphorus-dinner-cruise.png";

type BosphorusPackageCardProps = {
  locale: Locale;
  draft: BookingDraftView;
  onDraftChange: (draft: BookingDraftView) => void;
  onCheckout?: () => void;
};

export function BosphorusPackageCard({
  locale,
  draft,
  onDraftChange,
  onCheckout,
}: BosphorusPackageCardProps) {
  const copy = bosphorusDinnerCopy[locale];
  const booking = bookingCopy[locale];
  const pageCopy = bookingPageCopy[locale];
  const cardRef = useRef<HTMLElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Card lines follow applied only.
  const counts = draft.applied.bosphorusPax ?? emptyBosphorusPaxCounts();
  const lines = bosphorusLineItems(counts);
  const appliedAirportCode = pickupAirportCode(draft.applied.pickup);
  const meetAndGreetFeeEur = bosphorusMeetAndGreetFeeEur(
    appliedAirportCode,
    draft.applied.meetAndGreet,
  );
  const totalEur = quoteBosphorusDinnerPackageTotalEur(
    counts,
    appliedAirportCode,
    draft.applied.meetAndGreet,
  );
  const currency = draft.currency;
  const fxRates = draft.fxRates ?? {};
  const selectedCounts =
    draft.selected.bosphorusPax ?? emptyBosphorusPaxCounts();
  const paxUnapplied =
    selectedCounts.adultSoft !== counts.adultSoft ||
    selectedCounts.adultAlcohol !== counts.adultAlcohol ||
    selectedCounts.child5to9 !== counts.child5to9 ||
    selectedCounts.child0to4 !== counts.child0to4;
  const meetAndGreetUnapplied =
    draft.selected.meetAndGreet !== draft.applied.meetAndGreet;
  // Continue: applied bookable pax, and selected pax still match applied (incl. after hydrate).
  const canContinue =
    bosphorusHasBookablePax(counts) &&
    !paxUnapplied &&
    !meetAndGreetUnapplied &&
    !draft.distanceError;

  // Desktop: lock min-height once to the empty-state (baseline) sidebar height.
  // Do not follow later sidebar shrinks (e.g. needs-participants note hiding).
  // Applied line items may still grow the card downward via height: auto.
  useEffect(() => {
    const node = cardRef.current;
    if (!node) {
      return;
    }
    const target: HTMLElement = node;

    function clearMinHeight() {
      target.style.minHeight = "";
      delete target.dataset.bosphorusMinLocked;
    }

    function lockBaselineMinHeight() {
      if (!window.matchMedia(BOOKING_WIDE_QUERY).matches) {
        clearMinHeight();
        return;
      }
      if (target.dataset.bosphorusMinLocked === "1") {
        return;
      }
      const sidebar = document.querySelector(
        ".booking-selection--bosphorus .booking-sidebar",
      );
      if (!(sidebar instanceof HTMLElement)) {
        return;
      }
      const height = Math.ceil(sidebar.getBoundingClientRect().height);
      if (height <= 0) {
        return;
      }
      target.style.minHeight = `${height}px`;
      target.dataset.bosphorusMinLocked = "1";
    }

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(lockBaselineMinHeight);
    });

    function onResize() {
      if (!window.matchMedia(BOOKING_WIDE_QUERY).matches) {
        clearMinHeight();
        return;
      }
      lockBaselineMinHeight();
    }

    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      clearMinHeight();
    };
  }, []);

  function formatLineAmount(amountEur: number) {
    if (amountEur <= 0) {
      return copy.freeLabel;
    }
    const display = displayAmountFromEur(amountEur, currency, fxRates);
    if (display == null) {
      return formatCurrencyPill("EUR", amountEur, locale);
    }
    return formatCurrencyPill(currency, display, locale);
  }

  function totalFace(code: DisplayCurrency) {
    if (totalEur <= 0) {
      return formatCurrencyPill(code, 0, locale);
    }
    const display = displayAmountFromEur(totalEur, code, fxRates);
    return formatCurrencyPill(code, display, locale);
  }

  function signalNeedsParticipants() {
    window.dispatchEvent(new Event(BOSPHORUS_NEEDS_PARTICIPANTS_EVENT));
  }

  async function selectCurrency(code: DisplayCurrency) {
    if (code === currency) {
      return;
    }
    try {
      const response = await fetch("/api/booking/draft/selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, currency: code }),
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { draft: BookingDraftView };
      onDraftChange(payload.draft);
    } catch {
      /* ignore */
    }
  }

  async function continueCheckout() {
    if (submitting || !canContinue) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/booking/draft/bosphorus-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const payload = (await response.json()) as {
        draft?: BookingDraftView;
        error?: string;
      };
      if (!response.ok || !payload.draft) {
        setError(booking.persistError);
        return;
      }
      onDraftChange(payload.draft);
      onCheckout?.();
    } catch {
      setError(booking.persistError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article
      ref={cardRef}
      id="booking-bosphorus-package"
      className="vehicle-card booking-bosphorus-package glass-surface"
    >
      <div id="booking-bosphorus-media" className="booking-bosphorus-media">
        <Image
          src={BOSPHORUS_CARD_IMAGE}
          alt={copy.packageTitle}
          width={960}
          height={720}
          className="booking-bosphorus-media-image"
          sizes="(max-width: 899px) 100vw, 520px"
          priority={false}
        />
      </div>

      <div className="booking-bosphorus-lines" aria-label={copy.paxSectionLabel}>
        {lines.length === 0 ? (
          <p className="booking-bosphorus-note">{copy.needsParticipants}</p>
        ) : (
          lines.map((line) => (
            <div key={line.category} className="booking-bosphorus-line">
              <span className="booking-bosphorus-line-label">
                {copy.categoryShort[line.category]} × {line.quantity}
              </span>
              <span className="booking-bosphorus-line-amount">
                {formatLineAmount(line.lineEur)}
              </span>
            </div>
          ))
        )}
        {meetAndGreetFeeEur > 0 ? (
          <div className="booking-bosphorus-line">
            <span className="booking-bosphorus-line-label">
              {pageCopy.meetAndGreet}
            </span>
            <span className="booking-bosphorus-line-amount">
              {formatLineAmount(meetAndGreetFeeEur)}
            </span>
          </div>
        ) : null}
      </div>

      <hr className="booking-bosphorus-divider" />

      <div className="vehicle-card-total booking-bosphorus-totals">
        <p className="vehicle-card-total-label">{copy.totalLabel}</p>
        <div
          className="vehicle-card-currency-pills"
          role="radiogroup"
          aria-label={copy.totalLabel}
        >
          {DISPLAY_CURRENCIES.map((code) => {
            const checked = currency === code;
            const amount = displayAmountFromEur(totalEur, code, fxRates);
            const unavailable = totalEur > 0 && amount == null;
            const face = unavailable
              ? formatCurrencyPill(code, null, locale)
              : totalFace(code);
            return (
              <label
                key={code}
                data-currency={code}
                className={`vehicle-card-currency-pill${checked ? " is-selected" : ""}${unavailable ? " is-unavailable" : ""}`}
              >
                <input
                  type="radio"
                  name="bosphorus-currency"
                  value={code}
                  checked={checked}
                  disabled={unavailable}
                  onChange={() => {
                    void selectCurrency(code);
                  }}
                  aria-label={`${code}, ${face}`}
                />
                <span
                  className="vehicle-card-currency-pill-face"
                  aria-hidden="true"
                >
                  {face}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="booking-bosphorus-included">
        <p className="booking-trip-kicker">{copy.includedTitle}</p>
        <ul>
          {copy.included.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="booking-bosphorus-duration">{copy.durationNotice}</p>
      </div>

      <div className="booking-bosphorus-info-block">
        <p className="booking-trip-kicker">{copy.serviceInfoTitle}</p>
        <div className="booking-bosphorus-info-groups">
          {copy.serviceInfoGroups.map((group) => (
            <section key={group.title} className="booking-bosphorus-info-group">
              <h3>{group.title}</h3>
              <p className="booking-bosphorus-ops">{group.body}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="vehicle-card-select-wrap booking-bosphorus-select-wrap">
        <button
          type="button"
          className={`vehicle-card-select${canContinue ? "" : " is-blocked"}`}
          disabled={submitting}
          aria-disabled={!canContinue || undefined}
          onClick={() => {
            if (!canContinue) {
              signalNeedsParticipants();
              return;
            }
            void continueCheckout();
          }}
        >
          {copy.selectContinue}
        </button>
      </div>
      {error ? (
        <span className="booking-field-error booking-bosphorus-card-error">
          {error}
        </span>
      ) : null}
    </article>
  );
}
