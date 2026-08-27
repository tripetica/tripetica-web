"use client";

import { useState } from "react";
import { BookingCheckoutStage } from "@/components/booking/booking-checkout-stage";
import { BookingSelectionStage } from "@/components/booking/booking-selection-stage";
import { type BookingDraftView } from "@/lib/booking/draft-view";
import {
  defaultBookingPageConfig,
  type BookingPageConfig,
  type BookingStage,
} from "@/lib/booking/page-config";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

type BookingWorkspaceProps = {
  locale: Locale;
  config?: BookingPageConfig;
  initialDraft?: BookingDraftView | null;
};

function initialStage(draft: BookingDraftView | null): BookingStage {
  if (draft?.currentStage === "checkout" && draft.appliedVehicleCode) {
    return "checkout";
  }
  return "selection";
}

export function BookingWorkspace({
  locale,
  config = defaultBookingPageConfig,
  initialDraft = null,
}: BookingWorkspaceProps) {
  const [stage, setStage] = useState<BookingStage>(() => initialStage(initialDraft));
  const [draft, setDraft] = useState<BookingDraftView | null>(initialDraft);
  const copy = bookingPageCopy[locale];
  const homeHref = localizedPath(locale);

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
      {stage === "checkout" && draft?.appliedVehicleCode ? (
        <BookingCheckoutStage
          locale={locale}
          draft={draft}
          onDraftChange={setDraft}
          onBack={() => {
            setStage("selection");
            persistStage("selection");
          }}
        />
      ) : (
        <>
          <a href={homeHref} className="booking-back">
            {copy.back}
          </a>
          <BookingSelectionStage
            locale={locale}
            config={config}
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
