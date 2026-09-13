import { TOUR_SERVICE_TYPE } from "@/lib/booking/pricing/layover-pricing";
import {
  microEurFromDecimal,
  microEurToNumber,
  addMicroEur,
} from "@/lib/booking/pricing/euro";
import { type Locale } from "@/lib/i18n/config";

export const BOSPHORUS_DINNER_TOUR_CODE = "bosphorus-dinner";
export const BOSPHORUS_DINNER_PRICING_VERSION = "bosphorus-dinner.v2";
export const BOSPHORUS_MEET_AND_GREET_FEE_EUR = 5;
export const BOSPHORUS_NEEDS_PARTICIPANTS_EVENT =
  "tripetica:bosphorus-needs-participants";

/** Stored pickup_at local time = start of service pickup window. */
export const BOSPHORUS_SERVICE_PICKUP_LOCAL = "19:00";
export const BOSPHORUS_SERVICE_PICKUP_WINDOW = "19:00–20:00";
export const BOSPHORUS_SAME_DAY_BOOKING_CUTOFF_LOCAL = "17:30";

/**
 * Earliest bookable Istanbul local datetime for Bosphorus dinner.
 * Through 17:30 today → today at 19:00; after 17:30 → tomorrow at 19:00.
 * Uses Istanbul wall-clock `nowLocal` (`YYYY-MM-DDTHH:mm`) — no UTC day shift.
 */
export function bosphorusEarliestBookingLocal(nowLocal: string): string {
  const day = nowLocal.trim().slice(0, 10);
  const time = nowLocal.trim().slice(11, 16);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return bosphorusLocalDateTimeFromDate(day || "1970-01-01");
  }
  if (
    /^\d{2}:\d{2}$/.test(time) &&
    time <= BOSPHORUS_SAME_DAY_BOOKING_CUTOFF_LOCAL
  ) {
    return bosphorusLocalDateTimeFromDate(day);
  }
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + 1));
  const nextDay = next.toISOString().slice(0, 10);
  return bosphorusLocalDateTimeFromDate(nextDay);
}

/**
 * Checkout day rule for Bosphorus dinner — same cutoff as booking form.
 * Does NOT use the transfer +1 hour preparation check.
 */
export function evaluateBosphorusCheckoutDay(
  pickupAtLocal: string,
  nowLocal: string,
): { ok: true } | { ok: false; suggestedPickupAtLocal: string } {
  const earliest = bosphorusEarliestBookingLocal(nowLocal);
  const pickupDay = pickupAtLocal.trim().slice(0, 10);
  const earliestDay = earliest.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(pickupDay) && pickupDay >= earliestDay) {
    return { ok: true };
  }
  return { ok: false, suggestedPickupAtLocal: earliest };
}

export const BOSPHORUS_OPEN_DATE_EVENT = "tripetica:bosphorus-open-date";

export const BOSPHORUS_PAX_CATEGORIES = [
  "adultSoft",
  "adultAlcohol",
  "child5to9",
  "child0to4",
] as const;

export type BosphorusPaxCategory = (typeof BOSPHORUS_PAX_CATEGORIES)[number];

export type BosphorusPaxCounts = Record<BosphorusPaxCategory, number>;

/** EUR unit prices before FX conversion. */
export const BOSPHORUS_UNIT_PRICE_EUR: Record<BosphorusPaxCategory, number> = {
  adultSoft: 50,
  adultAlcohol: 60,
  child5to9: 40,
  child0to4: 0,
};

export const BOSPHORUS_PAX_MAX = 20;

export function isBosphorusDinnerTour(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return (
    serviceType?.trim() === TOUR_SERVICE_TYPE &&
    tourCode?.trim() === BOSPHORUS_DINNER_TOUR_CODE
  );
}

export function emptyBosphorusPaxCounts(): BosphorusPaxCounts {
  return {
    adultSoft: 0,
    adultAlcohol: 0,
    child5to9: 0,
    child0to4: 0,
  };
}

export function normalizeBosphorusPaxCount(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  const n = Math.floor(value);
  if (n < 0) {
    return 0;
  }
  if (n > BOSPHORUS_PAX_MAX) {
    return BOSPHORUS_PAX_MAX;
  }
  return n;
}

export function normalizeBosphorusPaxCounts(
  counts: Partial<BosphorusPaxCounts> | null | undefined,
): BosphorusPaxCounts {
  return {
    adultSoft: normalizeBosphorusPaxCount(counts?.adultSoft),
    adultAlcohol: normalizeBosphorusPaxCount(counts?.adultAlcohol),
    child5to9: normalizeBosphorusPaxCount(counts?.child5to9),
    child0to4: normalizeBosphorusPaxCount(counts?.child0to4),
  };
}

export function bosphorusTotalPax(counts: BosphorusPaxCounts) {
  return (
    counts.adultSoft +
    counts.adultAlcohol +
    counts.child5to9 +
    counts.child0to4
  );
}

export function bosphorusHasAdultPax(counts: BosphorusPaxCounts) {
  return counts.adultSoft + counts.adultAlcohol >= 1;
}

/** Children require at least one adult; otherwise child counts are forced to 0. */
export function clampBosphorusPaxAdultRule(
  counts: BosphorusPaxCounts,
): BosphorusPaxCounts {
  const normalized = normalizeBosphorusPaxCounts(counts);
  if (bosphorusHasAdultPax(normalized)) {
    return normalized;
  }
  return {
    ...normalized,
    child5to9: 0,
    child0to4: 0,
  };
}

export function bosphorusHasBookablePax(counts: BosphorusPaxCounts) {
  return bosphorusHasAdultPax(counts);
}

export function quoteBosphorusDinnerTotalEur(counts: BosphorusPaxCounts): number {
  let micro = microEurFromDecimal("0");
  for (const category of BOSPHORUS_PAX_CATEGORIES) {
    const unit = BOSPHORUS_UNIT_PRICE_EUR[category];
    const qty = counts[category];
    if (qty <= 0 || unit <= 0) {
      continue;
    }
    const line = microEurFromDecimal(String(unit * qty));
    micro = addMicroEur(micro, line);
  }
  return microEurToNumber(micro);
}

export function bosphorusMeetAndGreetFeeEur(
  pickupAirportCode: string | null | undefined,
  meetAndGreet: boolean | null | undefined,
) {
  const airportCode = pickupAirportCode?.trim().toUpperCase();
  return meetAndGreet === true && (airportCode === "IST" || airportCode === "SAW")
    ? BOSPHORUS_MEET_AND_GREET_FEE_EUR
    : 0;
}

export function quoteBosphorusDinnerPackageTotalEur(
  counts: BosphorusPaxCounts,
  pickupAirportCode: string | null | undefined,
  meetAndGreet: boolean | null | undefined,
) {
  return microEurToNumber(
    addMicroEur(
      microEurFromDecimal(String(quoteBosphorusDinnerTotalEur(counts))),
      microEurFromDecimal(
        String(
          bosphorusMeetAndGreetFeeEur(pickupAirportCode, meetAndGreet),
        ),
      ),
    ),
  );
}

export function bosphorusLineItems(counts: BosphorusPaxCounts): Array<{
  category: BosphorusPaxCategory;
  quantity: number;
  unitEur: number;
  lineEur: number;
}> {
  return BOSPHORUS_PAX_CATEGORIES.filter((category) => counts[category] > 0).map(
    (category) => {
      const quantity = counts[category];
      const unitEur = BOSPHORUS_UNIT_PRICE_EUR[category];
      return {
        category,
        quantity,
        unitEur,
        lineEur: microEurToNumber(
          microEurFromDecimal(String(unitEur * quantity)),
        ),
      };
    },
  );
}

/** Append fixed service pickup time to a YYYY-MM-DD date for storage. */
export function bosphorusLocalDateTimeFromDate(dateYmd: string): string {
  const day = dateYmd.trim().slice(0, 10);
  return `${day}T${BOSPHORUS_SERVICE_PICKUP_LOCAL}`;
}

export function bosphorusDateFromLocalDateTime(local: string): string {
  return local.trim().slice(0, 10);
}

export function bosphorusPaxLabel(
  category: BosphorusPaxCategory,
  locale: Locale,
): string {
  const labels: Record<Locale, Record<BosphorusPaxCategory, string>> = {
    tr: {
      adultSoft: "Yetişkin – Alkolsüz (10+ yaş)",
      adultAlcohol: "Yetişkin – Alkollü (18+ yaş)",
      child5to9: "Çocuk (5–9 yaş)",
      child0to4: "Çocuk (0–4 yaş)",
    },
    en: {
      adultSoft: "Adult – Soft drink (ages 10+)",
      adultAlcohol: "Adult – Alcoholic (ages 18+)",
      child5to9: "Child (ages 5–9)",
      child0to4: "Child (ages 0–4)",
    },
    ru: {
      adultSoft: "Взрослый – безалкогольный (10+ лет)",
      adultAlcohol: "Взрослый – алкогольный (18+ лет)",
      child5to9: "Ребёнок (5–9 лет)",
      child0to4: "Ребёнок (0–4 лет)",
    },
    ar: {
      adultSoft: "بالغ – مشروبات غير كحولية (10+ سنوات)",
      adultAlcohol: "بالغ – مشروبات كحولية (18+ سنوات)",
      child5to9: "طفل (5–9 سنوات)",
      child0to4: "طفل (0–4 سنوات)",
    },
  };
  return labels[locale][category];
}
