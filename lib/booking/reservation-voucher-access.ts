import "server-only";

import { query } from "@/lib/db/postgres";
import { BOOKING_TIME_ZONE } from "@/lib/booking/istanbul-time";
import { isAirportPickup } from "@/lib/booking/occupancy";
import { parseFxSnapshot } from "@/lib/booking/fx/convert";
import {
  DISPLAY_CURRENCIES,
  formatCurrencyPill,
  isDisplayCurrency,
  normalizeDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import { formatDurationHours, formatHourlyPackageCoverage, formatHourlyPackageOverrunNote } from "@/lib/booking/catalog";
import {
  BOSPHORUS_PAX_CATEGORIES,
  isBosphorusDinnerTour,
  normalizeBosphorusPaxCounts,
  type BosphorusPaxCounts,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { bosphorusDinnerCopy } from "@/lib/booking/bosphorus-dinner-copy";
import {
  parseReservationServiceSnapshot,
  reservationServiceContentForLocale,
  type ReservationServiceContent,
} from "@/lib/booking/reservation-service-snapshot";
import {
  shouldShowDistance,
  shouldShowDropoff,
} from "@/lib/booking/reservation-output-visibility";
import {
  formatPackageCoverageForTour,
  packageOverrunNoteForTour,
  bursaUludagFeeNote,
} from "@/lib/booking/tour-display";
import {
  voucherCopy,
  voucherPaymentLabel,
  voucherServiceTypeLabel,
} from "@/lib/booking/voucher-copy";
import { localizeVoucherAddressCountry } from "@/lib/booking/voucher-address";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import {
  reservationWaitingPolicyKind,
  type ReservationWaitingPolicyKind,
} from "@/lib/booking/reservation-document-policy";
import {
  manualOtherAmounts,
  parseManualPriceTotals,
  resolveStoredPriceAmount,
  type ManualPriceTotals,
} from "@/lib/ops/price-override";
import { passengerNoteText } from "@/lib/booking/passenger-note";
import { resolveReservationCustomerLocale } from "@/lib/booking/reservation-voucher-locale";
import { intlLocaleTag, type Locale } from "@/lib/i18n/config";

export type ReservationVoucherData = {
  reservationCode: string;
  locale: Locale;
  serviceTypeLabel: string;
  dateTime: string;
  durationValue: string | null;
  durationKmOverrunNote: string | null;
  packageCoverageValue: string | null;
  packageOverrunNote: string | null;
  packageExtraFeeNote: string | null;
  pickupName: string;
  pickupAddress: string;
  dropoffName: string;
  dropoffAddress: string;
  showDropoff: boolean;
  vehicleLabel: string;
  vehicleSubtitle: string | null;
  showVehicleClass: boolean;
  distanceLabel: string | null;
  showDistance: boolean;
  flightCode: string | null;
  passengerCount: number | null;
  luggageCount: number | null;
  babySeatCount: number | null;
  meetAndGreet: boolean | null;
  showMeetAndGreet: boolean;
  pickupIsAirport: boolean;
  paymentMethodLabel: string;
  totalLabel: string;
  otherCurrencyLine: string | null;
  contactPhone: string;
  contactEmail: string;
  passengerNote: string | null;
  passengerNames: string[];
  participantBreakdown: string[] | null;
  participantBreakdownHeading: string | null;
  /** Bosphorus tour voucher: package inclusions (separate section). */
  includedSectionTitle: string | null;
  includedItems: string[] | null;
  /** Bosphorus tour voucher: operational service notes (separate section). */
  serviceInfoSectionTitle: string | null;
  serviceInfoGroups: Array<{ title: string; body: string }> | null;
  /** Bosphorus-only cancellation policy (replaces transfer waiting/no-show blocks). */
  cancelPolicyTitle: string | null;
  cancelPolicyBody: string | null;
  waitingPolicyKind: ReservationWaitingPolicyKind | null;
};

type VoucherRow = {
  id: string;
  reservation_code: string;
  pickup_at: Date | null;
  pickup_name_customer: string | null;
  pickup_name_tr: string | null;
  pickup_address_customer: string | null;
  pickup_address_tr: string | null;
  dropoff_name_customer: string | null;
  dropoff_name_tr: string | null;
  dropoff_address_customer: string | null;
  dropoff_address_tr: string | null;
  vehicle_label_customer: string | null;
  vehicle_label_tr: string | null;
  vehicle_code: string | null;
  passenger_count: number | null;
  luggage_count: number | null;
  baby_seat_count: number | null;
  flight_code: string | null;
  meet_and_greet: boolean | null;
  distance_km: string | null;
  payment_method: string | null;
  pickup_location_type: string | null;
  pickup_airport_code: string | null;
  pickup_place_id: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total_price: string | null;
  currency: string | null;
  fx_snapshot: unknown;
  price_manually_overridden: boolean;
  manual_price_totals: unknown;
  locale: string | null;
  service_type: string | null;
  tour_code: string | null;
  duration_hours: string | number | null;
  bursa_route: string | null;
  service_content_snapshot: unknown;
  bosphorus_adult_soft: string | number | null;
  bosphorus_adult_alcohol: string | number | null;
  bosphorus_child_5_9: string | number | null;
  bosphorus_child_0_4: string | number | null;
  notes: string | null;
};

type PassengerRow = {
  sequence_no: number;
  first_name: string | null;
  last_name: string | null;
  is_primary_passenger: boolean;
};

function displayName(customer: string | null, tr: string | null) {
  return customer?.trim() || tr?.trim() || "";
}

function displayAddress(
  customer: string | null,
  tr: string | null,
  locale: Locale,
) {
  const raw = customer?.trim() || tr?.trim() || "";
  return raw ? localizeVoucherAddressCountry(raw, locale) : "";
}

function intlLocale(locale: Locale) {
  return intlLocaleTag(locale);
}

function formatVoucherDate(pickupAt: Date, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: BOOKING_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(pickupAt);
}

function formatVoucherTime(pickupAt: Date, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: BOOKING_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(pickupAt);
}

function formatVoucherDateTime(pickupAt: Date, locale: Locale) {
  return `${formatVoucherDate(pickupAt, locale)}, ${formatVoucherTime(pickupAt, locale)}`;
}

function formatDistanceLabel(
  distanceKm: string | null,
  locale: Locale,
  unit: string,
): string | null {
  if (!distanceKm?.trim()) {
    return null;
  }
  const value = Number(distanceKm);
  if (!Number.isFinite(value)) {
    return null;
  }
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
  return `${formatted} ${unit}`;
}

function passengerFullName(first: string | null, last: string | null) {
  return [first, last]
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

function voucherPassengerNames(
  passengers: PassengerRow[],
  fallbackFirst: string,
  fallbackLast: string,
): string[] {
  const sorted = [...passengers].sort((a, b) => {
    if (a.is_primary_passenger !== b.is_primary_passenger) {
      return a.is_primary_passenger ? -1 : 1;
    }
    return a.sequence_no - b.sequence_no;
  });
  const names = sorted
    .map((item) => passengerFullName(item.first_name, item.last_name))
    .filter((name) => name.trim());
  if (names.length > 0) {
    return names;
  }
  const fallback = passengerFullName(fallbackFirst, fallbackLast);
  return fallback.trim() ? [fallback] : [];
}

function otherCurrencyEquivalents(input: {
  locale: Locale;
  currency: string | null;
  fxSnapshot: unknown;
  priceManuallyOverridden: boolean;
  manualPriceTotals: ManualPriceTotals | null;
}): string | null {
  const selected = input.currency?.trim();
  if (!selected || !isDisplayCurrency(selected)) {
    return null;
  }

  const rows: Array<{ code: DisplayCurrency; amount: number }> = [];

  if (input.priceManuallyOverridden && input.manualPriceTotals) {
    for (const item of manualOtherAmounts({
      currency: selected,
      manualPriceTotals: input.manualPriceTotals,
    })) {
      const amount = Number(item.amount);
      if (Number.isFinite(amount)) {
        rows.push({ code: item.code, amount });
      }
    }
  } else {
    const snapshot = parseFxSnapshot(input.fxSnapshot);
    if (!snapshot) {
      return null;
    }
    for (const code of DISPLAY_CURRENCIES) {
      if (code === selected) {
        continue;
      }
      const raw = snapshot.totals[code];
      if (raw == null || String(raw).trim() === "") {
        continue;
      }
      const amount = Number(raw);
      if (!Number.isFinite(amount)) {
        continue;
      }
      rows.push({ code, amount });
    }
  }

  if (rows.length === 0) {
    return null;
  }

  return rows
    .map((item) => formatCurrencyPill(item.code, item.amount, input.locale))
    .join(" · ");
}

function asPaxCount(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function bosphorusCountsFromRow(row: VoucherRow): BosphorusPaxCounts {
  return normalizeBosphorusPaxCounts({
    adultSoft: asPaxCount(row.bosphorus_adult_soft),
    adultAlcohol: asPaxCount(row.bosphorus_adult_alcohol),
    child5to9: asPaxCount(row.bosphorus_child_5_9),
    child0to4: asPaxCount(row.bosphorus_child_0_4),
  });
}

function mapRow(
  row: VoucherRow,
  passengers: PassengerRow[],
  fallbackLocale?: Locale,
): ReservationVoucherData {
  const voucherLocale = resolveReservationCustomerLocale(
    row.locale,
    fallbackLocale,
  );
  const copy = voucherCopy[voucherLocale];
  const bookingLocale = voucherLocale;
  const pickupAt = row.pickup_at;
  const manualPriceTotals = parseManualPriceTotals(row.manual_price_totals);
  const price = resolveStoredPriceAmount({
    currency: row.currency,
    totalPrice: row.total_price,
    fxSnapshot: row.fx_snapshot,
    priceManuallyOverridden: row.price_manually_overridden,
    manualPriceTotals,
  });
  const currency = normalizeDisplayCurrency(price.currency);
  const amount = price.amount ? Number(price.amount) : null;
  const totalLabel =
    amount !== null && Number.isFinite(amount)
      ? formatCurrencyPill(currency, amount, bookingLocale)
      : "—";

  const mainFromPassengers = passengers.find((item) => item.is_primary_passenger);
  const mainFirstName =
    row.customer_first_name?.trim() ||
    mainFromPassengers?.first_name?.trim() ||
    "";
  const mainLastName =
    row.customer_last_name?.trim() ||
    mainFromPassengers?.last_name?.trim() ||
    "";

  const isHourly = row.service_type?.trim() === "hourly";
  const bosphorus = isBosphorusDinnerTour(row.service_type, row.tour_code);
  const bosphorusCopy = bosphorusDinnerCopy[bookingLocale];
  const snapshottedContent: ReservationServiceContent | null =
    reservationServiceContentForLocale(
      parseReservationServiceSnapshot(row.service_content_snapshot),
      bookingLocale,
    );
  const packageCoverageValue =
    snapshottedContent?.packageCoverage ??
    (bosphorus
      ? null
      : isHourly
        ? formatHourlyPackageCoverage(row.duration_hours, bookingLocale)
        : formatPackageCoverageForTour(row.tour_code, bookingLocale, {
            bursaRoute: row.bursa_route,
          }));
  const packageOverrunNote =
    snapshottedContent?.packageNotes.length
      ? snapshottedContent.packageNotes.join("\n")
      : bosphorus
        ? null
        : isHourly
          ? formatHourlyPackageOverrunNote(bookingLocale)
          : packageOverrunNoteForTour(row.tour_code, bookingLocale);
  const packageExtraFeeNote = snapshottedContent
    ? null
    : bosphorus
      ? null
      : bursaUludagFeeNote(row.tour_code, bookingLocale, row.bursa_route);
  const durationValue = isHourly
    ? formatDurationHours(row.duration_hours, bookingLocale)
    : null;

  const dateTime = (() => {
    if (!pickupAt) {
      return "—";
    }
    // Bosphorus stores technical pickup_at at 19:00; shown as reservation date/time.
    return formatVoucherDateTime(pickupAt, bookingLocale);
  })();

  const counts = bosphorus ? bosphorusCountsFromRow(row) : null;
  const participantBreakdown = counts
    ? BOSPHORUS_PAX_CATEGORIES.filter((category) => counts[category] > 0).map(
        (category) =>
          `${bosphorusCopy.categoryShort[category]} × ${counts[category]}`,
      )
    : null;

  const vehicleLabel =
    displayName(row.vehicle_label_customer, row.vehicle_label_tr) || "—";
  const vehicleSubtitle =
    snapshottedContent?.vehicleSubtitle ??
    (row.vehicle_code?.trim()
      ? vehicleCardCopyFor(row.vehicle_code.trim(), bookingLocale).example
      : null);
  const showVehicleClass = Boolean(row.vehicle_code?.trim()) || !bosphorus;

  const pickupIsAirport = isAirportPickup({
    airportCode: row.pickup_airport_code,
    locationType: row.pickup_location_type,
    placeId: row.pickup_place_id,
  });

  return {
    reservationCode: row.reservation_code,
    locale: bookingLocale,
    serviceTypeLabel: voucherServiceTypeLabel(
      row.service_type,
      bookingLocale,
      row.tour_code,
    ),
    dateTime,
    durationValue,
    durationKmOverrunNote: null,
    packageCoverageValue,
    packageOverrunNote,
    packageExtraFeeNote,
    pickupName: displayName(row.pickup_name_customer, row.pickup_name_tr) || "—",
    pickupAddress:
      displayAddress(
        row.pickup_address_customer,
        row.pickup_address_tr,
        bookingLocale,
      ) || "—",
    dropoffName: displayName(row.dropoff_name_customer, row.dropoff_name_tr) || "—",
    dropoffAddress:
      displayAddress(
        row.dropoff_address_customer,
        row.dropoff_address_tr,
        bookingLocale,
      ) || "—",
    showDropoff: shouldShowDropoff(row.service_type),
    vehicleLabel,
    vehicleSubtitle,
    showVehicleClass,
    distanceLabel: formatDistanceLabel(row.distance_km, bookingLocale, copy.distanceUnit),
    showDistance: shouldShowDistance(row.service_type),
    flightCode: row.flight_code?.trim() || null,
    passengerCount: row.passenger_count,
    luggageCount: bosphorus ? null : row.luggage_count,
    babySeatCount: bosphorus ? null : row.baby_seat_count,
    meetAndGreet: row.meet_and_greet,
    showMeetAndGreet: pickupIsAirport && !bosphorus,
    pickupIsAirport,
    paymentMethodLabel: voucherPaymentLabel(bookingLocale, row.payment_method),
    totalLabel,
    otherCurrencyLine: otherCurrencyEquivalents({
      locale: bookingLocale,
      currency: price.currency,
      fxSnapshot: row.fx_snapshot,
      priceManuallyOverridden: row.price_manually_overridden,
      manualPriceTotals,
    }),
    contactPhone: row.customer_phone?.trim() || "—",
    contactEmail: row.customer_email?.trim() || "—",
    passengerNote: passengerNoteText(row.notes),
    passengerNames: voucherPassengerNames(passengers, mainFirstName, mainLastName),
    participantBreakdown:
      participantBreakdown && participantBreakdown.length > 0
        ? participantBreakdown
        : null,
    participantBreakdownHeading: bosphorus
      ? bosphorusCopy.voucherPaxHeading
      : null,
    includedSectionTitle:
      snapshottedContent?.includedSectionTitle ??
      (bosphorus ? bosphorusCopy.voucherIncludedSectionTitle : null),
    includedItems: snapshottedContent?.includedItems.length
      ? snapshottedContent.includedItems
      : bosphorus
        ? [...bosphorusCopy.included, bosphorusCopy.durationNotice]
        : null,
    serviceInfoSectionTitle:
      snapshottedContent?.serviceInfoSectionTitle ??
      (bosphorus ? bosphorusCopy.voucherServiceInfoSectionTitle : null),
    serviceInfoGroups: bosphorus
      ? (
          snapshottedContent?.serviceInfoGroups.length
            ? snapshottedContent.serviceInfoGroups
            : bosphorusCopy.serviceInfoGroups
        ).map((group, index) => ({
          ...group,
          body: index === 0 ? bosphorusCopy.voucherPickupInfoBody : group.body,
        }))
      : snapshottedContent?.serviceInfoGroups.length
        ? snapshottedContent.serviceInfoGroups
        : null,
    cancelPolicyTitle: bosphorus
      ? bosphorusCopy.voucherCancelSectionTitle
      : null,
    cancelPolicyBody: bosphorus ? bosphorusCopy.voucherCancelBody : null,
    waitingPolicyKind: reservationWaitingPolicyKind(
      row.service_type,
      row.tour_code,
    ),
  };
}

export async function findReservationVoucherForSession(
  browserSessionId: string,
  reservationCode: string,
  fallbackLocale?: Locale,
): Promise<ReservationVoucherData | null> {
  const code = reservationCode.trim();
  if (!code) {
    return null;
  }
  const result = await query<VoucherRow>(
    `SELECT
        r.id,
        r.reservation_code,
        r.pickup_at,
        r.pickup_name_customer,
        r.pickup_name_tr,
        r.pickup_address_customer,
        r.pickup_address_tr,
        r.dropoff_name_customer,
        r.dropoff_name_tr,
        r.dropoff_address_customer,
        r.dropoff_address_tr,
        r.vehicle_label_customer,
        r.vehicle_label_tr,
        r.vehicle_code,
        r.passenger_count,
        r.luggage_count,
        r.baby_seat_count,
        r.flight_code,
        r.meet_and_greet,
        r.distance_km::text,
        r.payment_method,
        r.pickup_location_type,
        r.pickup_airport_code,
        r.pickup_place_id,
        r.customer_first_name,
        r.customer_last_name,
        r.customer_email,
        r.customer_phone,
        r.total_price::text,
        r.currency,
        r.fx_snapshot,
        r.price_manually_overridden,
        r.manual_price_totals,
        r.locale,
        r.service_type,
        r.tour_code,
        r.duration_hours,
        r.bursa_route,
        r.service_content_snapshot,
        r.bosphorus_adult_soft,
        r.bosphorus_adult_alcohol,
        r.bosphorus_child_5_9,
        r.bosphorus_child_0_4,
        r.notes
     FROM reservations r
     INNER JOIN reservation_searches s ON s.id = r.source_reservation_search_id
     WHERE s.browser_session_id = $1
       AND r.reservation_code = $2
       AND r.deleted_at IS NULL
     LIMIT 1`,
    [browserSessionId, code],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const passengers = await query<PassengerRow>(
    `SELECT sequence_no, first_name, last_name, is_primary_passenger
     FROM reservations_passengers
     WHERE reservation_id = $1
     ORDER BY sequence_no ASC`,
    [row.id],
  );
  return mapRow(row, passengers.rows, fallbackLocale);
}

export async function findReservationVoucherById(
  reservationId: string,
  fallbackLocale?: Locale,
): Promise<ReservationVoucherData | null> {
  const id = reservationId.trim();
  if (!id) {
    return null;
  }
  const result = await query<VoucherRow>(
    `SELECT
        r.id,
        r.reservation_code,
        r.pickup_at,
        r.pickup_name_customer,
        r.pickup_name_tr,
        r.pickup_address_customer,
        r.pickup_address_tr,
        r.dropoff_name_customer,
        r.dropoff_name_tr,
        r.dropoff_address_customer,
        r.dropoff_address_tr,
        r.vehicle_label_customer,
        r.vehicle_label_tr,
        r.vehicle_code,
        r.passenger_count,
        r.luggage_count,
        r.baby_seat_count,
        r.flight_code,
        r.meet_and_greet,
        r.distance_km::text,
        r.payment_method,
        r.pickup_location_type,
        r.pickup_airport_code,
        r.pickup_place_id,
        r.customer_first_name,
        r.customer_last_name,
        r.customer_email,
        r.customer_phone,
        r.total_price::text,
        r.currency,
        r.fx_snapshot,
        r.price_manually_overridden,
        r.manual_price_totals,
        r.locale,
        r.service_type,
        r.tour_code,
        r.duration_hours,
        r.bursa_route,
        r.service_content_snapshot,
        r.bosphorus_adult_soft,
        r.bosphorus_adult_alcohol,
        r.bosphorus_child_5_9,
        r.bosphorus_child_0_4,
        r.notes
     FROM reservations r
     WHERE r.id = $1
       AND r.deleted_at IS NULL
     LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const passengers = await query<PassengerRow>(
    `SELECT sequence_no, first_name, last_name, is_primary_passenger
     FROM reservations_passengers
     WHERE reservation_id = $1
     ORDER BY sequence_no ASC`,
    [row.id],
  );
  return mapRow(row, passengers.rows, fallbackLocale);
}

export function voucherPdfFilename(reservationCode: string) {
  const safe = reservationCode.replace(/[^A-Za-z0-9-]+/g, "").slice(0, 64);
  return `Tripetica-${safe || "voucher"}.pdf`;
}
