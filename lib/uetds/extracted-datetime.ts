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
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
  januar: 1,
  februar: 2,
  marz: 3,
  mai: 5,
  juni: 6,
  juli: 7,
  oktober: 10,
  dezember: 12,
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
  январь: 1,
  февраль: 2,
  март: 3,
  апрель: 4,
  май: 5,
  июнь: 6,
  июль: 7,
  август: 8,
  сентябрь: 9,
  октябрь: 10,
  ноябрь: 11,
  декабрь: 12,
};

const MONTH_PHRASE =
  /(\d{1,2})[ \t]+(\p{L}+)(?:[ \t]+(\d{4}))?(?:[ \t]+(?:saat(?:i)?|at|um|в|a[ \t]+las))?[ \t]*(\d{1,2})[:.](\d{2})(?:[ \t]*([ap])\.?m\.?)?/giu;
const MONTH_DATE =
  /(?<!\d)(\d{1,2})[ \t]+(\p{L}+)[ \t]+(\d{4})(?![ \t]*\d)/giu;
const MONTH_FIRST_PHRASE =
  /(?:(?<!\d)(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\s*,?\s*)?(\p{L}+)\s+(\d{1,2}),?\s+(\d{4})(?!\d)/giu;
const ISO_PHRASE =
  /(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:(?:[tT]|[ \t]+)(?:at|saat(?:i)?|um|в|a[ \t]+las)?[ \t]*(\d{1,2})[:.](\d{2})(?:[ \t]*([ap])\.?m\.?)?)?(?!\d)/giu;
const KOREAN_PHRASE =
  /(?<!\d)(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분?)?)?/gu;
const MERIDIEM_CLOCK = /(?<!\d)(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?(?!\p{L})/giu;
const TOMORROW_PHRASE =
  /(yarın|yarin|tomorrow)(?:\s+saati?)?\s+(\d{1,2})[:.](\d{2})/giu;
const CLOCK_PHRASE = /(?<!\d[./])(?<!\d)(\d{1,2})([:.])(\d{2})(?!\.\d)(?!\d)/g;
const NUMERIC_EXPLICIT =
  /(?<!\d)(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ \t]*(?:at|saat(?:i)?|um|в|a[ \t]+las|,)?[ \t]*(\d{1,2})[:.](\d{2})(?:[ \t]*([ap])\.?m\.?)?)?(?!\d)/giu;
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

type Found = SourceDateTime & { index: number; clockOnly?: boolean };
type ResolvedFound = ResolvedSourceDateTime & { index: number; clockOnly?: boolean };

function isResolved(item: Found): item is ResolvedFound {
  return item.status === "resolved";
}

function withMeridiem(hour: number, minute: number, meridiem: string | undefined) {
  if (!meridiem) {
    return hour <= 23 && minute <= 59 ? { hour, minute } : null;
  }
  const mark = meridiem.toLowerCase();
  if (hour < 1 || hour > 12 || minute > 59 || (mark !== "a" && mark !== "p")) {
    return null;
  }
  if (mark === "a") {
    return { hour: hour === 12 ? 0 : hour, minute };
  }
  return { hour: hour === 12 ? 12 : hour + 12, minute };
}

/** Both numbers can be a month. Day-first only when the reservation language says so. */
function numericDayMonth(first: number, second: number, text: string): { day: number; month: number } | null {
  if (first < 1 || second < 1 || first > 31 || second > 31) {
    return null;
  }
  if (first > 12 && second <= 12) {
    return { day: first, month: second };
  }
  if (second > 12 && first <= 12) {
    return { day: second, month: first };
  }
  if (first > 12 || second > 12) {
    return null;
  }
  const folded = foldToken(text);
  const dayFirst = /alis|alinis|tarih|saat|yolcu|birak|ucus|abholung|recogida|подач|трансфер|datum|fecha|hora|[а-яё]/.test(folded);
  return dayFirst ? { day: first, month: second } : null;
}

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

function roleAt(text: string, index: number): "start" | "end" | "ignore" | "unlabelled" {
  const lineStart = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  // The label is only the line that carries this clock. "Bırakma yeri" is a
  // place, so a later "Saati 23:00" stays an unlabeled start.
  const prefix = foldToken(text.slice(lineStart, index));
  if (/(flight|ucus|рейс|вылет|прилет|прилёт|kalkis|booking\s*created|created|olustur|check-?in|check-?out)/u.test(prefix)) {
    return "ignore";
  }
  if (/(bitis|birak(?:ma|is)\s+(?:saati|saat|zaman)|varis|drop-?off\s+(?:time|date)|end\s+(?:time|date)|высадк|прибыт)/u.test(prefix)) {
    return "end";
  }
  if (/(pick[\s-]*up|alis|alinis|baslangic|binis|transfer|departure|abholung|recogida|подач|трансфер|start\s+(?:time|date)|rezervasyon|tarih|date|saat|time|время|hora)/u.test(prefix)) {
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

function remember(found: Found[], spans: Array<{ start: number; end: number }>, item: Found | null, start: number, length: number) {
  if (!item) {
    return;
  }
  found.push(item);
  spans.push({ start, end: start + length });
}

function collectPhrases(text: string, nowUtcMs: number): Found[] {
  const found: Found[] = [];
  const spans: Array<{ start: number; end: number }> = [];
  for (const match of text.matchAll(ISO_PHRASE)) {
    if (match.index == null || overlaps(match.index, match[0].length, spans)) {
      continue;
    }
    const clock = match[4] == null ? { hour: 0, minute: 0 } : withMeridiem(Number(match[4]), Number(match[5]), match[6]);
    const item = clock
      ? explicitResult(Number(match[1]), Number(match[2]), Number(match[3]), clock.hour, clock.minute, match.index)
      : null;
    if (item && match[4] == null) {
      item.time = "";
    }
    remember(found, spans, item, match.index, match[0].length);
  }
  for (const match of text.matchAll(KOREAN_PHRASE)) {
    if (match.index == null || overlaps(match.index, match[0].length, spans)) {
      continue;
    }
    const hour = match[4] == null ? 0 : Number(match[4]);
    const minute = match[5] == null ? 0 : Number(match[5]);
    const item = explicitResult(Number(match[1]), Number(match[2]), Number(match[3]), hour, minute, match.index);
    if (item && match[4] == null) {
      item.time = "";
    }
    remember(found, spans, item, match.index, match[0].length);
  }
  for (const match of text.matchAll(MONTH_FIRST_PHRASE)) {
    const month = MONTHS[foldToken(match[4] ?? "")];
    if (!month || match.index == null || overlaps(match.index, match[0].length, spans)) {
      continue;
    }
    const clock = match[1] == null ? null : withMeridiem(Number(match[1]), match[2] == null ? 0 : Number(match[2]), match[3]);
    const item = explicitResult(
      Number(match[6]),
      month,
      Number(match[5]),
      clock?.hour ?? 0,
      clock?.minute ?? 0,
      match.index,
    );
    if (item && !clock) {
      item.time = "";
    }
    remember(found, spans, clock || match[1] == null ? item : null, match.index, match[0].length);
  }
  for (const match of text.matchAll(MONTH_PHRASE)) {
    const month = MONTHS[foldToken(match[2] ?? "")];
    if (!month || match.index == null || overlaps(match.index, match[0].length, spans)) {
      continue;
    }
    const clock = withMeridiem(Number(match[4]), Number(match[5]), match[6]);
    const day = Number(match[1]);
    const year = match[3] ? Number(match[3]) : null;
    const item = !clock
      ? null
      : year == null
        ? yearlessResult(month, day, clock.hour, clock.minute, nowUtcMs, match.index)
        : explicitResult(year, month, day, clock.hour, clock.minute, match.index);
    remember(found, spans, item, match.index, match[0].length);
  }
  for (const match of text.matchAll(MONTH_DATE)) {
    const month = MONTHS[foldToken(match[2] ?? "")];
    if (!month || match.index == null || overlaps(match.index, match[0].length, spans)) {
      continue;
    }
    const item = explicitResult(Number(match[3]), month, Number(match[1]), 0, 0, match.index);
    if (item) {
      item.time = "";
    }
    remember(found, spans, item, match.index, match[0].length);
  }
  for (const match of text.matchAll(NUMERIC_EXPLICIT)) {
    if (match.index == null || overlaps(match.index, match[0].length, spans)) {
      continue;
    }
    const order = numericDayMonth(Number(match[1]), Number(match[2]), text);
    if (!order) {
      remember(found, spans, { status: "rejected", index: match.index }, match.index, match[0].length);
      continue;
    }
    const clock = match[4] == null ? null : withMeridiem(Number(match[4]), Number(match[5]), match[6]);
    if (match[4] != null && !clock) {
      continue;
    }
    const item = explicitResult(Number(match[3]), order.month, order.day, clock?.hour ?? 0, clock?.minute ?? 0, match.index);
    if (item && !clock) {
      item.time = "";
    }
    remember(found, spans, item, match.index, match[0].length);
  }
  for (const match of text.matchAll(NUMERIC_YEARLESS)) {
    if (match.index == null || overlaps(match.index, match[0].length, spans)) {
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
  for (const match of text.matchAll(MERIDIEM_CLOCK)) {
    if (match.index == null || overlaps(match.index, match[0].length, spans)) {
      continue;
    }
    const meridiem = withMeridiem(Number(match[1]), match[2] == null ? 0 : Number(match[2]), match[3]);
    if (!meridiem) {
      continue;
    }
    const role = roleAt(text, match.index);
    spans.push({ start: match.index, end: match.index + match[0].length });
    if (role === "ignore") {
      continue;
    }
    if (role === "end") {
      const item = clockResult(todayDate(nowUtcMs), meridiem.hour, meridiem.minute, match.index);
      if (item) found.push(item);
      continue;
    }
    found.push({
      status: "resolved",
      date: "",
      time: clock(meridiem.hour, meridiem.minute),
      yearExplicit: false,
      clockOnly: true,
      index: match.index,
    });
  }
  for (const match of text.matchAll(CLOCK_PHRASE)) {
    if (match.index == null || overlaps(match.index, match[0].length, spans)) {
      continue;
    }
    const hour = Number(match[1]);
    const minute = Number(match[3]);
    const role = roleAt(text, match.index);
    // An explicit end keeps its clock. Every other clock stays dateless until a
    // written date on the reservation can claim it. A clock with no date is the
    // nearest future time within 12 hours, and outside that window it is not a start.
    if (role === "ignore") {
      continue;
    }
    if (role === "end") {
      const item = clockResult(todayDate(nowUtcMs), hour, minute, match.index);
      if (item) found.push(item);
      continue;
    }
    if (hour > 23 || minute > 59) {
      found.push({ status: "rejected", index: match.index });
      continue;
    }
    found.push({
      status: "resolved",
      date: "",
      time: clock(hour, minute),
      yearExplicit: false,
      clockOnly: true,
      index: match.index,
    });
  }
  return found.sort((left, right) => left.index - right.index);
}

function placeClocks(items: Found[], nowUtcMs: number, endClock: boolean): Found[] {
  const clocks = items.filter(isResolved).filter((item) => item.clockOnly);
  const rest = items.filter((item) => !(item.status === "resolved" && item.clockOnly));
  if (clocks.length === 0) {
    return rest;
  }
  const dated = rest.filter((item): item is ResolvedSourceDateTime & { index: number } => item.status === "resolved");
  const dateOnly = dated.filter((item) => !item.time);
  const complete = dated.filter((item) => item.time);
  if (complete.length === 0 && dateOnly.length === 1) {
    const times = new Set(clocks.map((item) => item.time));
    if (times.size !== 1) {
      return [...rest, { status: "rejected", index: clocks[0]!.index }];
    }
    return [
      ...rest.filter((item) => item.status === "rejected"),
      {
        status: "resolved",
        date: dateOnly[0]!.date,
        time: clocks[0]!.time,
        yearExplicit: dateOnly[0]!.yearExplicit,
        index: dateOnly[0]!.index,
      },
    ];
  }
  if (complete.length > 0) {
    return rest;
  }
  return [
    ...rest,
    ...clocks.map((item) => {
      const [hourText, minuteText] = item.time.split(":");
      const hour = Number(hourText);
      const minute = Number(minuteText);
      if (endClock) {
        return clockResult(todayDate(nowUtcMs), hour, minute, item.index) ?? { status: "rejected" as const, index: item.index };
      }
      const resolved = resolveDatelessClock({ hour, minute, nowUtcMs });
      if (!resolved) {
        return { status: "rejected" as const, index: item.index };
      }
      return clockResult(resolved.date, hour, minute, item.index) ?? { status: "rejected" as const, index: item.index };
    }),
  ];
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
    if (role === "ignore") {
      continue;
    }
    if (role === "end") {
      endItems.push(item);
    } else if (role === "start") {
      startItems.push(item);
    } else {
      bareItems.push(item);
    }
  }
  let startPool = startItems;
  let barePool = bareItems;
  const bareDateOnly = barePool.filter(isResolved).filter((item) => item.date && !item.time && !item.clockOnly);
  const startClocks = startPool.filter(isResolved).filter((item) => item.clockOnly);
  const startAlreadyDated = startPool.some((item) => item.status === "resolved" && item.date && !item.clockOnly);
  if (!startAlreadyDated && bareDateOnly.length === 1 && startClocks.length > 0 && new Set(startClocks.map((item) => item.time)).size === 1) {
    const written = bareDateOnly[0]!;
    startPool = [
      ...startPool.filter((item) => !item.clockOnly),
      ...startClocks.map((item) => ({
        ...item,
        date: written.date,
        yearExplicit: written.yearExplicit,
        clockOnly: false,
      })),
    ];
    barePool = barePool.filter((item) => item.index !== written.index);
  }
  const dateOnlyStart = startPool.filter(isResolved).filter((item) => item.date && !item.time && !item.clockOnly);
  const startHasClock = startPool.some((item) => item.status === "resolved" && (item.clockOnly || item.time));
  if (dateOnlyStart.length === 1 && !startHasClock) {
    const bareClocks = barePool.filter(isResolved).filter((item) => item.clockOnly);
    const times = new Set(bareClocks.map((item) => item.time));
    if (bareClocks.length > 0 && times.size === 1) {
      startPool = [
        ...startPool.filter((item) => !(item.status === "resolved" && !item.time)),
        { ...dateOnlyStart[0]!, time: bareClocks[0]!.time },
      ];
      const used = new Set(bareClocks.map((item) => item.index));
      barePool = barePool.filter((item) => !used.has(item.index));
    }
  }
  const labelledStart = uniqueResolved(placeClocks(startPool, nowUtcMs, false));
  const end = uniqueResolved(placeClocks(endItems, nowUtcMs, true));
  if (labelledStart) {
    return { start: labelledStart, end };
  }
  const bare = uniqueResolved(placeClocks(barePool, nowUtcMs, false));
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
