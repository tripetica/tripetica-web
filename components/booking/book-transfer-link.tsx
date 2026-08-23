"use client";

import { type ReactNode } from "react";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import {
  BOOKING_SERVICE_EVENT,
  bookingHash,
  type AirportCode,
  type BookingPrefill,
  type ServiceType,
  type TourId,
} from "@/lib/booking/types";

type BookTransferLinkProps = {
  locale: Locale;
  className: string;
  children: ReactNode;
  service?: ServiceType;
  tourId?: TourId;
  pickupAirport?: AirportCode;
};

export function BookTransferLink({
  locale,
  className,
  children,
  service = "transfer",
  tourId,
  pickupAirport,
}: BookTransferLinkProps) {
  const hash = bookingHash(service, { tourId, pickupAirport });
  const href = `${localizedPath(locale)}${hash}`;
  const prefill: BookingPrefill = { service, tourId, pickupAirport };

  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        const current = window.location.pathname.replace(/\/$/, "") || "/";
        if (current !== localizedPath(locale)) {
          return;
        }
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent(BOOKING_SERVICE_EVENT, { detail: prefill }),
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        history.replaceState(null, "", hash);
      }}
    >
      {children}
    </a>
  );
}
