"use client";

import { useState } from "react";
import { BookingSelectionStage } from "@/components/booking/booking-selection-stage";
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
};

export function BookingWorkspace({
  locale,
  config = defaultBookingPageConfig,
}: BookingWorkspaceProps) {
  const [stage] = useState<BookingStage>("selection");
  const copy = bookingPageCopy[locale];
  const homeHref = localizedPath(locale);

  return (
    <div className="booking-workspace">
      {stage === "selection" ? (
        <>
          <a href={homeHref} className="booking-back">
            {copy.back}
          </a>
          <BookingSelectionStage locale={locale} config={config} />
        </>
      ) : null}
    </div>
  );
}
