import { istanbulLocalToUtcMs, formatUtcToIstanbulLocal } from "@/lib/booking/istanbul-time";

export const WHEEL_UNSET_VALUE = "--";

const LOCAL_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

export function ceilIstanbulLocalToFiveMinutes(local: string): string {
  const utcMs = istanbulLocalToUtcMs(local);
  if (!Number.isFinite(utcMs)) {
    return local;
  }
  const minute = Number(formatUtcToIstanbulLocal(utcMs).slice(14, 16));
  const remainder = minute % 5;
  if (remainder === 0) {
    return formatUtcToIstanbulLocal(utcMs);
  }
  return formatUtcToIstanbulLocal(utcMs + (5 - remainder) * 60_000);
}

export function effectiveBookingMin(min: string | null | undefined): string | null {
  if (!min?.trim()) {
    return null;
  }
  return ceilIstanbulLocalToFiveMinutes(min.trim());
}

export function minDatePart(min: string | null): string {
  return min?.split("T")[0] ?? "";
}

export function minTimePart(min: string | null): string {
  const time = min?.split("T")[1];
  return time?.slice(0, 5) ?? "";
}

export function dateHasBookingConstraint(draftDate: string, min: string | null): boolean {
  if (!draftDate || !min) {
    return false;
  }
  return draftDate === minDatePart(min);
}

export function wheelItemToValue(item: string): string {
  return item === WHEEL_UNSET_VALUE ? "" : item;
}

export function valueToWheelItem(value: string): string {
  return value || WHEEL_UNSET_VALUE;
}

export function withUnsetOption(items: string[]) {
  return [WHEEL_UNSET_VALUE, ...items];
}

export function hourWheelItems() {
  return withUnsetOption(
    Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0")),
  );
}

export function minuteWheelItems() {
  return withUnsetOption(
    Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0")),
  );
}

export function isHourWheelItemDisabled(
  item: string,
  draftDate: string,
  min: string | null,
  hourInteracted: boolean,
): boolean {
  if (item === WHEEL_UNSET_VALUE) {
    if (!hourInteracted) {
      return false;
    }
    return dateHasBookingConstraint(draftDate, min);
  }
  if (!dateHasBookingConstraint(draftDate, min) || !min) {
    return false;
  }
  return `${draftDate}T${item}:55` < min;
}

export function isMinuteWheelItemDisabled(
  item: string,
  draftHour: string,
  draftDate: string,
  min: string | null,
  minuteInteracted: boolean,
): boolean {
  if (!draftHour) {
    return true;
  }
  if (item === WHEEL_UNSET_VALUE) {
    if (!minuteInteracted) {
      return false;
    }
    return dateHasBookingConstraint(draftDate, min);
  }
  if (!dateHasBookingConstraint(draftDate, min) || !min) {
    return false;
  }
  return `${draftDate}T${draftHour}:${item}` < min;
}

export function firstValidHourItem(
  items: string[],
  draftDate: string,
  min: string | null,
  hourInteracted: boolean,
): string | null {
  return (
    items.find(
      (item) =>
        item !== WHEEL_UNSET_VALUE &&
        !isHourWheelItemDisabled(item, draftDate, min, hourInteracted),
    ) ?? null
  );
}

export function firstValidMinuteItem(
  items: string[],
  draftHour: string,
  draftDate: string,
  min: string | null,
  minuteInteracted: boolean,
): string | null {
  return (
    items.find(
      (item) =>
        item !== WHEEL_UNSET_VALUE &&
        !isMinuteWheelItemDisabled(item, draftHour, draftDate, min, minuteInteracted),
    ) ?? null
  );
}

export function snapHourWheelItem(
  centerItem: string,
  items: string[],
  draftDate: string,
  min: string | null,
  hourInteracted: boolean,
): string {
  const constrained = dateHasBookingConstraint(draftDate, min);
  if (!constrained) {
    return wheelItemToValue(centerItem);
  }
  if (!hourInteracted && centerItem === WHEEL_UNSET_VALUE) {
    return "";
  }
  if (
    centerItem !== WHEEL_UNSET_VALUE &&
    !isHourWheelItemDisabled(centerItem, draftDate, min, hourInteracted)
  ) {
    return wheelItemToValue(centerItem);
  }
  const startIndex = Math.max(0, items.indexOf(centerItem));
  for (let index = startIndex; index < items.length; index += 1) {
    const item = items[index];
    if (
      item !== WHEEL_UNSET_VALUE &&
      !isHourWheelItemDisabled(item, draftDate, min, hourInteracted)
    ) {
      return wheelItemToValue(item);
    }
  }
  const fallback = firstValidHourItem(items, draftDate, min, hourInteracted);
  return fallback ? wheelItemToValue(fallback) : "";
}

export function snapMinuteWheelItem(
  centerItem: string,
  items: string[],
  draftHour: string,
  draftDate: string,
  min: string | null,
  minuteInteracted: boolean,
): string {
  if (!draftHour) {
    return "";
  }
  const constrained = dateHasBookingConstraint(draftDate, min);
  if (!constrained) {
    return wheelItemToValue(centerItem);
  }
  if (!minuteInteracted && centerItem === WHEEL_UNSET_VALUE) {
    return "";
  }
  if (
    centerItem !== WHEEL_UNSET_VALUE &&
    !isMinuteWheelItemDisabled(centerItem, draftHour, draftDate, min, minuteInteracted)
  ) {
    return wheelItemToValue(centerItem);
  }
  const startIndex = Math.max(0, items.indexOf(centerItem));
  for (let index = startIndex; index < items.length; index += 1) {
    const item = items[index];
    if (
      item !== WHEEL_UNSET_VALUE &&
      !isMinuteWheelItemDisabled(item, draftHour, draftDate, min, minuteInteracted)
    ) {
      return wheelItemToValue(item);
    }
  }
  const fallback = firstValidMinuteItem(
    items,
    draftHour,
    draftDate,
    min,
    minuteInteracted,
  );
  return fallback ? wheelItemToValue(fallback) : "";
}

export function correctMinuteForHour(
  draftHour: string,
  draftMinute: string,
  draftDate: string,
  min: string | null,
  minuteInteracted: boolean,
): string {
  if (!draftHour || !draftMinute) {
    return draftMinute;
  }
  if (
    !isMinuteWheelItemDisabled(
      draftMinute,
      draftHour,
      draftDate,
      min,
      minuteInteracted,
    )
  ) {
    return draftMinute;
  }
  const next = firstValidMinuteItem(
    minuteWheelItems(),
    draftHour,
    draftDate,
    min,
    true,
  );
  return next ? wheelItemToValue(next) : "";
}

export function isDraftDatetimeValid(
  draftDate: string,
  draftHour: string,
  draftMinute: string,
  min: string | null,
): boolean {
  if (!draftDate || !draftHour || !draftMinute) {
    return false;
  }
  const local = `${draftDate}T${draftHour}:${draftMinute}`;
  if (!LOCAL_PATTERN.test(local)) {
    return false;
  }
  if (!min) {
    return true;
  }
  return local >= min;
}
