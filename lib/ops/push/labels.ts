import { bookingCopy } from "@/lib/booking/copy";
import { localizedTourName } from "@/lib/booking/tour-display";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import { type TourId } from "@/lib/booking/types";

export const OPS_PUSH_LOCALE = "tr" as const;

export const BOOKABLE_TOUR_CODES = [
  "istanbul-layover",
  "istanbul-half-day",
  "istanbul-full-day",
  "sapanca",
  "bursa",
  "bosphorus-dinner",
] as const satisfies readonly TourId[];

const BOOKABLE_TOUR_SET = new Set<string>(BOOKABLE_TOUR_CODES);

export const PRIVATE_TURKEY_TOURS_CODE = "private-turkey-tours";

export function isBookableTourCode(
  tourCode: string | null | undefined,
): boolean {
  const id = tourCode?.trim();
  return Boolean(id && BOOKABLE_TOUR_SET.has(id));
}

export function opsServiceLabel(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): string {
  const type = serviceType?.trim();
  if (type === "tour" && isBookableTourCode(tourCode)) {
    return localizedTourName(tourCode, OPS_PUSH_LOCALE) ?? bookingCopy.tr.services.tour;
  }
  if (type === "transfer" || type === "hourly" || type === "tour") {
    return bookingCopy.tr.services[type];
  }
  return bookingCopy.tr.services.transfer;
}

export function opsHourlyServiceLabel(durationHours: number | null | undefined): string {
  const base = bookingCopy.tr.services.hourly;
  if (durationHours == null || !Number.isFinite(durationHours) || durationHours <= 0) {
    return base;
  }
  const hours = Number.isInteger(durationHours)
    ? String(durationHours)
    : String(durationHours);
  return `${base} • ${hours} ${bookingCopy.tr.hoursSuffix}`;
}

export function opsVehicleLabel(
  vehicleCode: string | null | undefined,
  vehicleLabelTr: string | null | undefined,
): string | null {
  const code = vehicleCode?.trim();
  if (code) {
    return vehicleCardCopyFor(code, OPS_PUSH_LOCALE).title;
  }
  const stored = vehicleLabelTr?.trim();
  return stored || null;
}

export function opsPlaceLabel(
  nameTr: string | null | undefined,
  nameCustomer: string | null | undefined,
): string | null {
  const tr = nameTr?.trim();
  if (tr) {
    return tr;
  }
  const customer = nameCustomer?.trim();
  return customer || null;
}

export function formatOpsPushDateTime(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const day = part("day");
  const month = part("month");
  const year = part("year");
  const hour = part("hour").padStart(2, "0");
  const minute = part("minute").padStart(2, "0");
  if (!day || !month || !year || !hour || !minute) {
    return null;
  }
  return `${day} ${month} ${year} • ${hour}:${minute}`;
}

export function formatOpsPassengerCount(count: number | null | undefined): string | null {
  if (count == null || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  return `${count} yolcu`;
}

export function formatOpsPrice(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (amount == null || amount === "") {
    return null;
  }
  const numeric = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const code = currency?.trim().toUpperCase();
  const digits = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
  return code ? `${digits} ${code}` : digits;
}
