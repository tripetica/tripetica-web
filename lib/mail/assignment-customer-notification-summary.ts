import { BOOKING_TIME_ZONE } from "@/lib/booking/istanbul-time";
import { bookingCopy } from "@/lib/booking/copy";
import { localizedTourName } from "@/lib/booking/tour-display";
import {
  BUS_CODE,
  BUSINESS_MINIVAN_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MIDIBUS_CODE,
  MINIBUS_CODE,
  PREMIUM_ECONOMY_SEDAN_CODE,
  STANDARD_MINIVAN_CODE,
} from "@/lib/booking/pricing/vehicle-quote";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import { intlLocaleTag, type Locale } from "@/lib/i18n/config";
import { assignmentCustomerNotificationCopy } from "@/lib/mail/assignment-customer-notification-copy";
import { reservationMailCopy } from "@/lib/mail/reservation-copy";

const KNOWN_VEHICLE_CODES = new Set([
  PREMIUM_ECONOMY_SEDAN_CODE,
  STANDARD_MINIVAN_CODE,
  BUSINESS_MINIVAN_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MINIBUS_CODE,
  MIDIBUS_CODE,
  BUS_CODE,
]);

export type AssignmentNotifySummaryPassenger = {
  sequence_no: number;
  first_name: string | null;
  last_name: string | null;
  is_primary_passenger: boolean;
};

export type AssignmentNotifySummarySource = {
  reservationCode: string;
  pickupAt: Date | null;
  serviceType: string | null;
  tourCode: string | null;
  durationHours: string | number | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  pickupNameCustomer: string | null;
  pickupNameTr: string | null;
  dropoffNameCustomer: string | null;
  dropoffNameTr: string | null;
  vehicleLabelCustomer: string | null;
  vehicleLabelTr: string | null;
  vehicleCode: string | null;
  passengers: readonly AssignmentNotifySummaryPassenger[];
};

export type AssignmentNotifySummaryRow = {
  label: string;
  value: string;
};

function displayName(customer: string | null | undefined, tr: string | null | undefined) {
  return customer?.trim() || tr?.trim() || "";
}

function passengerFullName(first: string | null | undefined, last: string | null | undefined) {
  return [first, last]
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

function looksLikeInternalCode(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && !value.includes(" ");
}

function meaningfulPlace(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed) && trimmed !== "—" && trimmed !== "-";
}

export function formatAssignmentNotifyDate(pickupAt: Date, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocaleTag(locale), {
    timeZone: BOOKING_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(pickupAt);
}

export function formatAssignmentNotifyTime(pickupAt: Date, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocaleTag(locale), {
    timeZone: BOOKING_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(pickupAt);
}

export function formatAssignmentNotifyDateTime(pickupAt: Date, locale: Locale) {
  return `${formatAssignmentNotifyDate(pickupAt, locale)} · ${formatAssignmentNotifyTime(pickupAt, locale)}`;
}

export function resolveAssignmentNotifyFirstPassengerName(
  source: AssignmentNotifySummarySource,
) {
  const sorted = [...source.passengers].sort((a, b) => {
    if (a.is_primary_passenger !== b.is_primary_passenger) {
      return a.is_primary_passenger ? -1 : 1;
    }
    return a.sequence_no - b.sequence_no;
  });
  const first = sorted[0];
  const fromPassengers = passengerFullName(first?.first_name, first?.last_name);
  if (fromPassengers) {
    return fromPassengers;
  }
  return passengerFullName(source.customerFirstName, source.customerLastName) || null;
}

export function resolveAssignmentNotifyServiceLabel(
  serviceType: string | null | undefined,
  locale: Locale,
) {
  const raw = serviceType?.trim();
  if (raw === "transfer" || raw === "hourly" || raw === "tour") {
    return bookingCopy[locale].services[raw];
  }
  return null;
}

export function resolveAssignmentNotifyDurationLabel(
  durationHours: string | number | null | undefined,
  locale: Locale,
) {
  if (durationHours === null || durationHours === undefined || durationHours === "") {
    return null;
  }
  const numeric =
    typeof durationHours === "number" ? durationHours : Number(durationHours);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  const hours = Number.isInteger(numeric) ? String(numeric) : String(numeric);
  return `${hours} ${bookingCopy[locale].hoursSuffix}`;
}

export function resolveAssignmentNotifyVehicleClassLabel(
  source: Pick<
    AssignmentNotifySummarySource,
    "vehicleLabelCustomer" | "vehicleLabelTr" | "vehicleCode"
  >,
  locale: Locale,
) {
  const stored = displayName(source.vehicleLabelCustomer, source.vehicleLabelTr);
  if (stored && !looksLikeInternalCode(stored)) {
    return stored;
  }
  const code = source.vehicleCode?.trim() || stored;
  if (code && KNOWN_VEHICLE_CODES.has(code)) {
    return vehicleCardCopyFor(code, locale).title;
  }
  return null;
}

function pushRow(
  rows: AssignmentNotifySummaryRow[],
  label: string,
  value: string | null | undefined,
) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "—" || trimmed === "-") {
    return;
  }
  rows.push({ label, value: trimmed });
}

export function buildAssignmentNotifySummaryRows(
  source: AssignmentNotifySummarySource,
  locale: Locale,
): AssignmentNotifySummaryRow[] {
  const copy = assignmentCustomerNotificationCopy[locale];
  const mailCopy = reservationMailCopy[locale];
  const serviceType = source.serviceType?.trim().toLowerCase() ?? "";
  const isTour = serviceType === "tour";
  const isHourly = serviceType === "hourly";
  const pickupAt =
    source.pickupAt && !Number.isNaN(source.pickupAt.getTime())
      ? source.pickupAt
      : null;
  const pickup = displayName(source.pickupNameCustomer, source.pickupNameTr);
  const dropoff = displayName(source.dropoffNameCustomer, source.dropoffNameTr);

  const rows: AssignmentNotifySummaryRow[] = [];
  pushRow(rows, mailCopy.reservationCode, source.reservationCode);
  pushRow(rows, copy.passenger, resolveAssignmentNotifyFirstPassengerName(source));
  pushRow(
    rows,
    copy.dateTime,
    pickupAt ? formatAssignmentNotifyDateTime(pickupAt, locale) : null,
  );
  pushRow(rows, copy.service, resolveAssignmentNotifyServiceLabel(source.serviceType, locale));
  if (isTour) {
    pushRow(rows, copy.tour, localizedTourName(source.tourCode, locale));
  }
  if (isHourly || isTour) {
    pushRow(
      rows,
      copy.duration,
      resolveAssignmentNotifyDurationLabel(source.durationHours, locale),
    );
  }
  pushRow(rows, copy.vehicleClass, resolveAssignmentNotifyVehicleClassLabel(source, locale));
  pushRow(rows, isTour ? copy.tourStart : copy.pickup, pickup);
  if (meaningfulPlace(dropoff)) {
    pushRow(rows, isTour ? copy.tourEnd : copy.dropoff, dropoff);
  }
  return rows;
}
