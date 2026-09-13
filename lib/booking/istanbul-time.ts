import { type Locale } from "@/lib/i18n/config";

export const BOOKING_TIME_ZONE = "Europe/Istanbul";

export type IstanbulClock = {
  timeZone: typeof BOOKING_TIME_ZONE;
  nowUtcMs: number;
  nowLocal: string;
  earliestUtcMs: number;
  earliestLocal: string;
};

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function getIstanbulClock(nowUtcMs = Date.now()): IstanbulClock {
  const earliestUtcMs = nowUtcMs + 60 * 60 * 1000;
  return {
    timeZone: BOOKING_TIME_ZONE,
    nowUtcMs,
    nowLocal: formatUtcToIstanbulLocal(nowUtcMs),
    earliestUtcMs,
    earliestLocal: formatUtcToIstanbulLocal(earliestUtcMs),
  };
}

export function formatUtcToIstanbulLocal(utcMs: number): string {
  const parts = zonedParts(utcMs, BOOKING_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function timestamptzToIstanbulLocal(value: Date | string | number) {
  const utcMs =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value);
  if (!Number.isFinite(utcMs)) {
    return "";
  }
  return formatUtcToIstanbulLocal(utcMs);
}

export function istanbulLocalToUtcMs(local: string): number {
  const match = local.match(LOCAL_PATTERN);
  if (!match) {
    return Number.NaN;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  const firstOffset = getTimeZoneOffsetMs(wallAsUtc, BOOKING_TIME_ZONE);
  let utcMs = wallAsUtc - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(utcMs, BOOKING_TIME_ZONE);
  if (secondOffset !== firstOffset) {
    utcMs = wallAsUtc - secondOffset;
  }
  return utcMs;
}

export function isIstanbulLocalOnOrAfter(
  local: string,
  earliestLocal: string,
): boolean {
  if (!LOCAL_PATTERN.test(local) || !LOCAL_PATTERN.test(earliestLocal)) {
    return false;
  }
  return local >= earliestLocal;
}

export function formatIstanbulLocalDisplay(local: string, locale: Locale) {
  const match = local.match(LOCAL_PATTERN);
  if (!match) {
    return local.replace("T", " ");
  }
  const year = match[1];
  const month = MONTH_LABELS[locale][Number(match[2]) - 1];
  const day = String(Number(match[3]));
  const time = `${match[4]}:${match[5]}`;
  return `${day} ${month} ${year} ${time}`;
}

/** Date part only (no clock time) for date-only booking flows. */
export function formatIstanbulLocalDateDisplay(local: string, locale: Locale) {
  const match = local.match(LOCAL_PATTERN) ?? local.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return local.replace("T", " ").slice(0, 10);
  }
  const year = match[1];
  const month = MONTH_LABELS[locale][Number(match[2]) - 1];
  const day = String(Number(match[3]));
  return `${day} ${month} ${year}`;
}

/** Full month name, date only — e.g. "31 Ağustos 2026". */
export function formatIstanbulLocalDateDisplayLong(local: string, locale: Locale) {
  const match = local.match(LOCAL_PATTERN) ?? local.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return local.replace("T", " ").slice(0, 10);
  }
  const year = match[1];
  const month = MONTH_LABELS_LONG[locale][Number(match[2]) - 1];
  const day = String(Number(match[3]));
  return `${day} ${month} ${year}`;
}

export function formatIstanbulLocalDisplayLong(local: string, locale: Locale) {
  const match = local.match(LOCAL_PATTERN);
  if (!match) {
    return local.replace("T", " ");
  }
  const year = match[1];
  const month = MONTH_LABELS_LONG[locale][Number(match[2]) - 1];
  const day = String(Number(match[3]));
  const time = `${match[4]}:${match[5]}`;
  return `${day} ${month} ${year}, ${time}`;
}

const MONTH_LABELS: Record<Locale, readonly string[]> = {
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ru: ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};

const MONTH_LABELS_LONG: Record<Locale, readonly string[]> = {
  tr: [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  ru: [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ],
  ar: [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ],
};

function zonedParts(utcMs: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const entries = formatter.formatToParts(new Date(utcMs)).filter(
    (part) => part.type !== "literal",
  );
  const parts = Object.fromEntries(
    entries.map((part) => [part.type, part.value]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function getTimeZoneOffsetMs(utcMs: number, timeZone: string) {
  const parts = zonedParts(utcMs, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}
