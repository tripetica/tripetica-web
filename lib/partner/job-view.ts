import { formatDurationHours } from "@/lib/booking/catalog";
import { bookingCopy } from "@/lib/booking/copy";
import { pickupIsAirport } from "@/lib/booking/meet-and-greet";
import { type Locale } from "@/lib/i18n/config";
import { bookingServiceDisplayLabel, localizedTourName } from "@/lib/booking/tour-display";
import { foldDriverSearchText } from "@/lib/partner/driver-list-view";

export const PARTNER_JOB_NOTE_PREVIEW_MAX = 48;

export type PartnerJobOccupancyCopy = {
  jobPassengerUnit: string;
  jobBagUnit: string;
  jobBabySeatUnit: string;
};

export function partnerJobPlaceName(
  customer: string | null | undefined,
  tr: string | null | undefined,
) {
  return customer?.trim() || tr?.trim() || null;
}

export function partnerJobIsAirportPickup(input: {
  pickupLocationType: string | null;
  pickupAirportCode: string | null;
  pickupPlaceId: string | null;
}) {
  return pickupIsAirport({
    locationType: input.pickupLocationType,
    airportCode: input.pickupAirportCode,
    placeId: input.pickupPlaceId,
  });
}

export function partnerJobOccupancyLine(
  input: {
    passengerCount: number | null;
    luggageCount: number | null;
    babySeatCount: number | null;
  },
  copy: PartnerJobOccupancyCopy,
) {
  const parts = [
    `${input.passengerCount ?? 0} ${copy.jobPassengerUnit}`,
    `${input.luggageCount ?? 0} ${copy.jobBagUnit}`,
  ];
  if ((input.babySeatCount ?? 0) > 0) {
    parts.push(`${input.babySeatCount} ${copy.jobBabySeatUnit}`);
  }
  return parts.join(" · ");
}

export function partnerJobOccupancyCompact(input: {
  passengerCount: number | null;
  luggageCount: number | null;
}) {
  return `${input.passengerCount ?? 0} / ${input.luggageCount ?? 0}`;
}

export function partnerJobNotePreview(notes: string | null | undefined, presentLabel: string) {
  const value = notes?.trim() ?? "";
  if (!value) {
    return null;
  }
  if (value.length <= PARTNER_JOB_NOTE_PREVIEW_MAX) {
    return value;
  }
  return presentLabel;
}

export function partnerJobDurationLabel(
  serviceType: string | null | undefined,
  hours: string | number | null | undefined,
  locale: Locale,
) {
  if (serviceType?.trim() !== "hourly") {
    return "—";
  }
  return formatDurationHours(hours, locale) ?? "—";
}

export function partnerJobServiceLabel(
  serviceType: string | null,
  tourCode: string | null,
  locale: Locale,
) {
  return bookingServiceDisplayLabel(serviceType, tourCode, locale);
}

export function partnerJobServiceTypeLabel(
  serviceType: string | null | undefined,
  locale: Locale,
) {
  const raw = serviceType?.trim();
  if (raw === "transfer" || raw === "hourly" || raw === "tour") {
    return bookingCopy[locale].services[raw];
  }
  return raw || null;
}

export function partnerJobTourName(tourCode: string | null | undefined, locale: Locale) {
  return localizedTourName(tourCode, locale);
}

export function partnerJobGenderValue(value: string | null | undefined) {
  const raw = value?.trim().toLowerCase();
  if (raw === "female" || raw === "male") {
    return raw;
  }
  return null;
}

export function partnerJobGenderLabel(
  value: string | null | undefined,
  copy: { jobPassengerGenderFemale: string; jobPassengerGenderMale: string },
) {
  const gender = partnerJobGenderValue(value);
  if (gender === "female") {
    return copy.jobPassengerGenderFemale;
  }
  if (gender === "male") {
    return copy.jobPassengerGenderMale;
  }
  return null;
}

export function partnerPassengerIdentityFields(identityNumber: string | null | undefined) {
  const value = identityNumber?.trim() || null;
  if (!value) {
    return { passportNumber: null, nationalId: null };
  }
  const compact = value.replace(/\s+/g, "");
  if (/^\d{11}$/.test(compact)) {
    return { passportNumber: null, nationalId: compact };
  }
  return { passportNumber: value, nationalId: null };
}

export const PARTNER_EMPTY_IDENTITY_DISPLAY = "11111111111";

export function partnerPassengerIdentityDisplay(
  nationalId: string | null | undefined,
  passportNumber: string | null | undefined,
) {
  const value = nationalId?.trim() || passportNumber?.trim() || "";
  return value || PARTNER_EMPTY_IDENTITY_DISPLAY;
}

export function partnerJobMatchesSearch(
  job: {
    pickupName: string | null;
    dropoffName: string | null;
    serviceLabel: string;
    reservationCode?: string | null;
  },
  query: string,
) {
  const raw = query.trim();
  if (!raw) {
    return true;
  }
  const haystack = foldDriverSearchText(
    [job.pickupName, job.dropoffName, job.serviceLabel, job.reservationCode]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(foldDriverSearchText(raw));
}

export function filterPartnerJobs<
  T extends {
    pickupName: string | null;
    dropoffName: string | null;
    serviceLabel: string;
    reservationCode?: string | null;
  },
>(jobs: readonly T[], query: string): T[] {
  return jobs.filter((job) => partnerJobMatchesSearch(job, query));
}

export type PartnerJobSort = "newest" | "service";

export function sortPartnerJobs<
  T extends { id: string; createdAt: string; pickupAt: string },
>(jobs: readonly T[], sort: PartnerJobSort): T[] {
  const items = jobs.slice();
  if (sort === "service") {
    items.sort((left, right) => {
      const byPickup = left.pickupAt.localeCompare(right.pickupAt);
      return byPickup !== 0 ? byPickup : left.id.localeCompare(right.id);
    });
    return items;
  }
  items.sort((left, right) => {
    const byCreated = right.createdAt.localeCompare(left.createdAt);
    return byCreated !== 0 ? byCreated : right.id.localeCompare(left.id);
  });
  return items;
}
