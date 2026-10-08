import { formatUtcToIstanbulLocal, istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";

/** Yearless day/month/time is accepted only inside [now, now + 30 days]. */
export const UETDS_YEARLESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** A clock with no day uses the nearest future time inside this window. */
export const UETDS_DATELESS_CLOCK_WINDOW_MS = 12 * 60 * 60 * 1000;

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
  /(\d{1,2})\s+([A-Za-zÀ-ÿĞğİıÖöŞşÜüÇç]+)(?:\s+(\d{4}))?(?:\s+saati?)?\s+(\d{1,2})[:.](\d{2})/giu;
const TOMORROW_PHRASE =
  /(yarın|yarin|tomorrow)(?:\s+saati?)?\s+(\d{1,2})[:.](\d{2})/giu;
const CLOCK_PHRASE = /(?<!\d[./])(?<!\d)(\d{1,2})([:.])(\d{2})(?!\.\d)(?!\d)/g;
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
  const before = text.slice(Math.max(0, index - 80), index).toLocaleLowerCase("tr-TR");
  // The label is only the phrase attached to this clock. "Bırakma yeri" is a
  // place, so a later "Saati 23:00" stays an unlabeled start.
  const endLabel = /(?:bitiş|bitis|bırak(?:ma|ış|is)?|birak(?:ma|is)?|varış|varis|drop-?off|end(?:\s+(?:time|date))?)\s*(?:saati|saat|zaman[ıi])?\s*[:\-]?\s*$/u;
  const startLabel = /(?:başlangıç|baslangic|alış|alis|biniş|binis|pick-?up|start(?:\s+(?:time|date))?|tarih|date)\s*(?:saati|saat|zaman[ıi])?\s*[:\-]?\s*$/u;
  if (endLabel.test(before)) {
    return "end";
  }
  if (startLabel.test(before)) {
    return "start";
  }
  return "unlabelled";
}

function todayDate(nowUtcMs: number) {
  return formatUtcToIstanbulLocal(nowUtcMs).slice(0, 10);
}

function tomorrowDate(nowUtcMs: number) {
  const today = todayDate(nowUtcMs);
  const noon = istanbulLocalToUtcMs(`${today}T12:00`);
  return formatUtcToIstanbulLocal(noon + 24 * 60 * 60 * 1000).slice(0, 10);
}

/** No written day: the nearest strictly future clock inside the next 12 hours. */
export function resolveDatelessClock(input: {
  hour: number;
  minute: number;
  nowUtcMs: number;
}): { date: string; time: string } | null {
  if (input.hour < 0 || input.hour > 23 || input.minute < 0 || input.minute > 59) {
    return null;
  }
  const time = clock(input.hour, input.minute);
  const windowEnd = input.nowUtcMs + UETDS_DATELESS_CLOCK_WINDOW_MS;
  for (const date of [todayDate(input.nowUtcMs), tomorrowDate(input.nowUtcMs)]) {
    const utc = istanbulLocalToUtcMs(`${date}T${time}`);
    if (Number.isFinite(utc) && utc > input.nowUtcMs && utc <= windowEnd) {
      return { date, time };
    }
  }
  return null;
}

function clockResult(date: string, hour: number, minute: number, index: number): Found | null {
  if (hour > 23 || minute > 59 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  return {
    status: "resolved",
    date,
    time: clock(hour, minute),
    yearExplicit: false,
    index,
  };
}

function overlaps(index: number, length: number, spans: Array<{ start: number; end: number }>) {
  const end = index + length;
  return spans.some((span) => index < span.end && end > span.start);
}

function collectPhrases(text: string, nowUtcMs: number): Found[] {
  const found: Found[] = [];
  const spans: Array<{ start: number; end: number }> = [];
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
      spans.push({ start: match.index, end: match.index + match[0].length });
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
      spans.push({ start: match.index, end: match.index + match[0].length });
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
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  for (const match of text.matchAll(TOMORROW_PHRASE)) {
    if (match.index == null || overlaps(match.index, match[0].length, spans)) {
      continue;
    }
    const item = clockResult(tomorrowDate(nowUtcMs), Number(match[2]), Number(match[3]), match.index);
    if (item) {
      found.push(item);
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  for (const match of text.matchAll(CLOCK_PHRASE)) {
    if (match.index == null || overlaps(match.index, match[0].length, spans)) {
      continue;
    }
    const hour = Number(match[1]);
    const minute = Number(match[3]);
    // An explicit end keeps its clock. Every other clock is a start, placed on
    // the nearest future time within 12 hours. Outside that window it is not a start.
    if (roleAt(text, match.index) === "end") {
      const item = clockResult(todayDate(nowUtcMs), hour, minute, match.index);
      if (item) found.push(item);
      continue;
    }
    const resolved = resolveDatelessClock({ hour, minute, nowUtcMs });
    if (!resolved) {
      found.push({ status: "rejected", index: match.index });
      continue;
    }
    const item = clockResult(resolved.date, hour, minute, match.index);
    if (item) found.push(item);
  }
  return found.sort((left, right) => left.index - right.index);
}

function withoutIndex(item: Found): SourceDateTime {
  if (item.status === "rejected") {
    return { status: "rejected" };
  }
  return {
    status: "resolved",
    date: item.date,
    time: item.time,
    yearExplicit: item.yearExplicit,
  };
}

function uniqueResolved(items: Found[]): SourceDateTime | null {
  if (items.length === 0) {
    return null;
  }
  const resolved = items.filter((item) => item.status === "resolved");
  const keys = new Set(resolved.map((item) => `${item.date}T${item.time}`));
  if (keys.size > 1) {
    return { status: "rejected" };
  }
  if (keys.size === 1) {
    return withoutIndex(resolved[0]!);
  }
  if (items.some((item) => item.status === "rejected")) {
    return { status: "rejected" };
  }
  return null;
}

export function parseDescribedTripDates(text: string, nowUtcMs: number): {
  start: SourceDateTime | null;
  end: SourceDateTime | null;
} {
  const startItems: Found[] = [];
  const endItems: Found[] = [];
  const bareItems: Found[] = [];
  for (const item of collectPhrases(text, nowUtcMs)) {
    const role = roleAt(text, item.index);
    if (role === "end") {
      endItems.push(item);
    } else if (role === "start") {
      startItems.push(item);
    } else {
      bareItems.push(item);
    }
  }
  const labelledStart = uniqueResolved(startItems);
  const end = uniqueResolved(endItems);
  if (labelledStart) {
    return { start: labelledStart, end };
  }
  const bare = uniqueResolved(bareItems);
  return { start: bare, end };
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
  // An image or file often shows only "23:00". That clock is still the start.
  if (clockParts && !modelDate) {
    const resolved = resolveDatelessClock({ ...clockParts, nowUtcMs });
    return resolved ?? { date: undefined, time: undefined };
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
  let start = sideFromModel(input.startDate, input.startTime, described.start, input.nowUtcMs);
  let end = sideFromModel(input.endDate, input.endTime, described.end, input.nowUtcMs);
  const text = input.description.trim();
  const explicitEnd = described.end?.status === "resolved";
  const explicitStart = described.start?.status === "resolved";
  // Two unlabeled clocks are not a start and not an end.
  if (described.start?.status === "rejected" && !explicitEnd) {
    start = { date: undefined, time: undefined };
    end = { date: undefined, time: undefined };
  }
  // A file/image clock filed as the end, with no explicit end phrase, is the start.
  // The end never rewrites a start that is already present.
  if (!explicitStart && !explicitEnd && !start.time && end.time) {
    start = { date: end.date, time: end.time };
    end = { date: undefined, time: undefined };
  }
  // A drop-off clock never rewrites the start. A clock with no date uses the start date.
  if (
    explicitEnd &&
    described.end?.status === "resolved" &&
    !described.end.yearExplicit &&
    start.date &&
    end.time
  ) {
    end = { date: start.date, time: end.time };
  }
  if (text && explicitStart && !explicitEnd) {
    end = { date: undefined, time: undefined };
  } else if (
    !explicitEnd &&
    start.date &&
    start.time &&
    start.date === end.date &&
    start.time === end.time
  ) {
    end = { date: undefined, time: undefined };
  }
  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
  };
}
