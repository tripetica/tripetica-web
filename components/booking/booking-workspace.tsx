"use client";

import { useState } from "react";
import { BookingCheckoutStage } from "@/components/booking/booking-checkout-stage";
import { BookingSelectionStage } from "@/components/booking/booking-selection-stage";
import { EditModeBanner } from "@/components/booking/edit-mode-banner";
import { type BookingDraftView } from "@/lib/booking/draft-view";
import {
  bookingPageConfigForDraft,
  defaultBookingPageConfig,
  type BookingPageConfig,
  type BookingStage,
} from "@/lib/booking/page-config";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { BOSPHORUS_OPEN_DATE_EVENT } from "@/lib/booking/pricing/bosphorus-dinner-pricing";

type BookingWorkspaceProps = {
  locale: Locale;
  config?: BookingPageConfig;
  initialDraft?: BookingDraftView | null;
  accountPrefill?: import("@/lib/booking/checkout-account-prefill").CheckoutAccountPrefill | null;
};

function initialStage(draft: BookingDraftView | null): BookingStage {
  if (draft?.currentStage !== "checkout") {
    return "selection";
  }
  if (draft.appliedVehicleCode) {
    return "checkout";
  }
  if (
    draft.tourCode === "bosphorus-dinner" &&
    draft.appliedVehicleTotal != null
  ) {
    return "checkout";
  }
  return "selection";
}

function canShowCheckout(draft: BookingDraftView | null) {
  if (!draft || draft.currentStage !== "checkout") {
    return false;
  }
  if (draft.appliedVehicleCode) {
    return true;
  }
  return (
    draft.tourCode === "bosphorus-dinner" && draft.appliedVehicleTotal != null
  );
}

export function BookingWorkspace({
  locale,
  config = defaultBookingPageConfig,
  initialDraft = null,
  accountPrefill = null,
}: BookingWorkspaceProps) {
  const [stage, setStage] = useState<BookingStage>(() => initialStage(initialDraft));
  const [draft, setDraft] = useState<BookingDraftView | null>(initialDraft);
  const copy = bookingPageCopy[locale];
  const homeHref = localizedPath(locale);
  const pageConfig = draft
    ? bookingPageConfigForDraft(draft.serviceType, draft.tourCode)
    : config;

  function persistStage(next: BookingStage) {
    void fetch("/api/booking/draft/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, stage: next }),
    })
      .then((response) => response.json())
      .then((payload: { draft?: BookingDraftView }) => {
        if (payload.draft) {
          setDraft(payload.draft);
        }
      })
      .catch(() => undefined);
  }

  return (
    <div className="booking-workspace">
      {draft?.editMode && draft.editReservationCode ? (
        <EditModeBanner
          locale={locale}
          reservationCode={draft.editReservationCode}
          reservationId={draft.editReservationId}
          opsEditMode={draft.opsEditMode}
          opsEditWithinSixHours={draft.opsEditWithinSixHours}
        />
      ) : null}
      {stage === "checkout" && draft && canShowCheckout(draft) ? (
        <BookingCheckoutStage
          locale={locale}
          draft={draft}
          accountPrefill={accountPrefill}
          onDraftChange={setDraft}
          onBack={() => {
            setStage("selection");
            persistStage("selection");
          }}
          onChooseAnotherDate={() => {
            setStage("selection");
            persistStage("selection");
            window.setTimeout(() => {
              window.dispatchEvent(new CustomEvent(BOSPHORUS_OPEN_DATE_EVENT));
            }, 50);
          }}
        />
      ) : (
        <>
          <a href={homeHref} className="booking-back">
            {copy.back}
          </a>
          <BookingSelectionStage
            locale={locale}
            config={pageConfig}
            draft={draft}
            onDraftChange={setDraft}
            onCheckout={() => {
              setStage("checkout");
            }}
          />
        </>
      )}
    </div>
  );
}
