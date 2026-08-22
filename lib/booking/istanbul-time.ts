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

export function formatIstanbulLocalDisplay(local: string, locale: "ru" | "en") {
  const utcMs = istanbulLocalToUtcMs(local);
  if (Number.isNaN(utcMs)) {
    return local.replace("T", " ");
  }
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    timeZone: BOOKING_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(utcMs));
}

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
