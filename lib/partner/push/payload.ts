import { formatDurationHours } from "@/lib/booking/catalog";
import { bookingServiceDisplayLabel, formatPackageCoverageForTour } from "@/lib/booking/tour-display";
import { type Locale } from "@/lib/i18n/config";
import { partnerJobPlaceName } from "@/lib/partner/job-view";

export const PARTNER_JOB_PUSH_KIND = "partner-job";

export type PartnerJobPushPayload = {
  kind: typeof PARTNER_JOB_PUSH_KIND;
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  url: string;
  requireInteraction: boolean;
};

export type PartnerJobPushSource = {
  reservationId: string;
  locale: Locale;
  title: string;
  payoutTitle: string;
  payoutLabel: string;
  serviceType: string | null;
  tourCode: string | null;
  pickupAt: Date | string | null;
  pickupNameCustomer: string | null;
  pickupNameTr: string | null;
  dropoffNameCustomer: string | null;
  dropoffNameTr: string | null;
  durationHours: string | number | null;
  bursaRoute?: string | null;
};

function compactLines(lines: Array<string | null | undefined>): string {
  return lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line) && line !== "—" && line !== "-")
    .join("\n");
}

export function formatPartnerPushDateTime(
  value: Date | string | null | undefined,
  locale: Locale,
): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const localeTag = locale === "ru" ? "ru-RU" : locale === "tr" ? "tr-TR" : "en-GB";
  const parts = new Intl.DateTimeFormat(localeTag, {
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
  const day = part("day").padStart(2, "0");
  const month = part("month");
  const year = part("year");
  const hour = part("hour").padStart(2, "0");
  const minute = part("minute").padStart(2, "0");
  if (!day || !month || !year || !hour || !minute) {
    return null;
  }
  return `${day} ${month} ${year} · ${hour}:${minute}`;
}

function pickupName(source: PartnerJobPushSource) {
  return partnerJobPlaceName(source.pickupNameCustomer, source.pickupNameTr);
}

function dropoffName(source: PartnerJobPushSource) {
  return partnerJobPlaceName(source.dropoffNameCustomer, source.dropoffNameTr);
}

function hourlyDuration(source: PartnerJobPushSource) {
  return formatDurationHours(source.durationHours, source.locale);
}

function tourDuration(source: PartnerJobPushSource) {
  return formatPackageCoverageForTour(source.tourCode, source.locale, {
    bursaRoute: source.bursaRoute,
  });
}

function routeLine(source: PartnerJobPushSource, includeDropoff: boolean) {
  const pickup = pickupName(source);
  const dropoff = includeDropoff ? dropoffName(source) : null;
  if (pickup && dropoff) {
    return `${pickup} → ${dropoff}`;
  }
  return pickup ?? dropoff ?? null;
}

export function buildPartnerJobPushPayload(source: PartnerJobPushSource): PartnerJobPushPayload {
  const type = source.serviceType?.trim() ?? "";
  const service = bookingServiceDisplayLabel(source.serviceType, source.tourCode, source.locale);
  const payout =
    source.payoutLabel.trim() && source.payoutLabel !== "—"
      ? `${source.payoutTitle}: ${source.payoutLabel}`
      : null;

  let place: string | null = null;
  let duration: string | null = null;
  if (type === "hourly") {
    place = routeLine(source, Boolean(dropoffName(source)));
    duration = hourlyDuration(source);
  } else if (type === "tour") {
    place = routeLine(source, Boolean(dropoffName(source)));
    duration = tourDuration(source);
  } else {
    place = routeLine(source, true);
  }

  return {
    kind: PARTNER_JOB_PUSH_KIND,
    title: source.title,
    body: compactLines([
      formatPartnerPushDateTime(source.pickupAt, source.locale),
      service,
      place,
      duration,
      payout,
    ]),
    icon: "/icon.png",
    badge: "/icon.png",
    tag: `partner-job:${source.reservationId}`,
    url: `/${source.locale}/partner/jobs/${source.reservationId}`,
    requireInteraction: true,
  };
}
