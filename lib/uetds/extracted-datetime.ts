import { formatUtcToIstanbulLocal, istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";

/** Yearless day/month/time is accepted only inside [now, now + 30 days]. */
export const UETDS_YEARLESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type ResolvedSourceDateTime = {
  status: "resolved";
  date: string;
  time: string;
  yearExplicit: boolean;
};

export type RejectedSourceDateTime = {
  status: "rejected";
};

export type SourceDateTime = ResolvedSourceDateTime | RejectedSourceDateTime;

const MONTHS: Record<string, number> = {
  ocak: 1,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  eylul: 9,
  ekim: 10,
  kasim: 11,
  aralik: 12,
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTH_PHRASE =
  /(\d{1,2})\s+([A-Za-zÀ-ÿĞğİıÖöŞşÜüÇç]+)(?:\s+(\d{4}))?\s+(\d{1,2})[:.](\d{2})/gu;
const NUMERIC_EXPLICIT =
  /(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/g;
const NUMERIC_YEARLESS =
  /(\d{1,2})[./](\d{1,2})\s+(\d{1,2})[:.](\d{2})/g;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function foldToken(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

function isValidCivil(year: number, month: number, day: number, hour: number, minute: number) {
  if (month < 1 || month > 12 || day < 1 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function clock(hour: number, minute: number) {
  return `${pad(hour)}:${pad(minute)}`;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * A day/month/time with no written year matches at most one timestamp in the
 * forward window. A past date is not rolled into next year.
 */
export function resolveYearlessCivilDateTime(input: {
  month: number;
  day: number;
  hour: number;
  minute: number;
  nowUtcMs: number;
}): { date: string; time: string } | null {
  const nowLocal = formatUtcToIstanbulLocal(input.nowUtcMs);
  const nowYear = Number(nowLocal.slice(0, 4));
  const windowEnd = input.nowUtcMs + UETDS_YEARLESS_WINDOW_MS;
  const matches: { date: string; time: string }[] = [];
  for (const year of [nowYear - 1, nowYear, nowYear + 1]) {
    if (!isValidCivil(year, input.month, input.day, input.hour, input.minute)) {
      continue;
    }
    const date = isoDate(year, input.month, input.day);
    const time = clock(input.hour, input.minute);
    const utc = istanbulLocalToUtcMs(`${date}T${time}`);
    if (Number.isFinite(utc) && utc >= input.nowUtcMs && utc <= windowEnd) {
      matches.push({ date, time });
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

type Found = SourceDateTime & { index: number };

function explicitResult(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  index: number,
): (ResolvedSourceDateTime & { index: number }) | null {
  if (!isValidCivil(year, month, day, hour, minute)) {
    return null;
  }
  return {
    status: "resolved",
    date: isoDate(year, month, day),
    time: clock(hour, minute),
    yearExplicit: true,
    index,
  };
}

function yearlessResult(month: number, day: number, hour: number, minute: number, nowUtcMs: number, index: number): Found | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  const resolved = resolveYearlessCivilDateTime({ month, day, hour, minute, nowUtcMs });
  if (!resolved) {
    return { status: "rejected", index };
  }
  return {
    status: "resolved",
    date: resolved.date,
    time: resolved.time,
    yearExplicit: false,
    index,
  };
}

function roleAt(text: string, index: number): "start" | "end" | "unlabelled" {
  const before = text.slice(Math.max(0, index - 64), index).toLocaleLowerCase("tr-TR");
  if (/bitiş|bitis|bırak|birak|varış|varis|drop-?off|end\s+(?:time|date)/u.test(before)) {
    return "end";
  }
  if (/başlangıç|baslangic|alış|alis|biniş|binis|pick-?up|start\s+(?:time|date)|tarih|date/u.test(before)) {
    return "start";
  }
  return "unlabelled";
}

function collectPhrases(text: string, nowUtcMs: number): Found[] {
  const found: Found[] = [];
  for (const match of text.matchAll(MONTH_PHRASE)) {
    const month = MONTHS[foldToken(match[2] ?? "")];
    if (!month || match.index == null) {
      continue;
    }
    const day = Number(match[1]);
    const year = match[3] ? Number(match[3]) : null;
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const item = year == null
      ? yearlessResult(month, day, hour, minute, nowUtcMs, match.index)
      : explicitResult(year, month, day, hour, minute, match.index);
    if (item) {
      found.push(item);
    }
  }
  for (const match of text.matchAll(NUMERIC_EXPLICIT)) {
    if (match.index == null) {
      continue;
    }
    const hour = match[4] == null ? 0 : Number(match[4]);
    const minute = match[5] == null ? 0 : Number(match[5]);
    const item = explicitResult(Number(match[3]), Number(match[2]), Number(match[1]), hour, minute, match.index);
    if (item && match[4] == null) {
      item.time = "";
    }
    if (item) {
      found.push(item);
    }
  }
  for (const match of text.matchAll(NUMERIC_YEARLESS)) {
    if (match.index == null) {
      continue;
    }
    const item = yearlessResult(
      Number(match[2]),
      Number(match[1]),
      Number(match[3]),
      Number(match[4]),
      nowUtcMs,
      match.index,
    );
    if (item) {
      found.push(item);
    }
  }
  return found.sort((left, right) => left.index - right.index);
}

export function parseDescribedTripDates(text: string, nowUtcMs: number): {
  start: SourceDateTime | null;
  end: SourceDateTime | null;
} {
  let start: SourceDateTime | null = null;
  let end: SourceDateTime | null = null;
  for (const item of collectPhrases(text, nowUtcMs)) {
    const role = roleAt(text, item.index);
    const value: SourceDateTime = item.status === "rejected"
      ? { status: "rejected" }
      : {
          status: "resolved",
          date: item.date,
          time: item.time,
          yearExplicit: item.yearExplicit,
        };
    if (role === "end") {
      if (!end) {
        end = value;
      }
      continue;
    }
    if (role === "start" || !start) {
      if (!start) {
        start = value;
      }
      continue;
    }
    if (!end) {
      end = value;
    }
  }
  return { start, end };
}

export function yearlessSentinelDate(value: string | null | undefined) {
  const match = value?.match(/^0000-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { month, day };
}

function parseClock(value: string | undefined) {
  const match = value?.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function sideFromModel(
  modelDate: string | undefined,
  modelTime: string | undefined,
  described: SourceDateTime | null,
  nowUtcMs: number,
) {
  if (described?.status === "resolved") {
    return {
      date: described.date || undefined,
      time: described.time || modelTime || undefined,
    };
  }
  if (described?.status === "rejected") {
    return { date: undefined, time: undefined };
  }
  const sentinel = yearlessSentinelDate(modelDate);
  const clockParts = parseClock(modelTime);
  if (sentinel && clockParts) {
    const resolved = resolveYearlessCivilDateTime({ ...sentinel, ...clockParts, nowUtcMs });
    if (!resolved) {
      return { date: undefined, time: undefined };
    }
    return resolved;
  }
  if (modelDate && !sentinel) {
    return { date: modelDate, time: modelTime };
  }
  return { date: undefined, time: undefined };
}

/** Text with an explicit or yearless date wins over a model-guessed year. */
export function reconcileExtractedTripDates(input: {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  description: string;
  nowUtcMs: number;
}) {
  const described = parseDescribedTripDates(input.description, input.nowUtcMs);
  const start = sideFromModel(input.startDate, input.startTime, described.start, input.nowUtcMs);
  const end = sideFromModel(input.endDate, input.endTime, described.end, input.nowUtcMs);
  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
  };
}
