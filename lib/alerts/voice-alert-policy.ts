import { BOOKING_TIME_ZONE } from "@/lib/booking/istanbul-time";

export const URGENT_VOICE_ALERT_WINDOW_MS = 120 * 60 * 1000;

export const VOICE_ALERT_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';

const NIGHT_WINDOW_START_SECONDS = 1 * 60; // 00:01:00 inclusive
const NIGHT_WINDOW_END_SECONDS = 8 * 60 * 60; // 08:00:00 inclusive
const MORNING_PICKUP_LIMIT_SECONDS = 10 * 60 * 60; // 10:00:00 exclusive

export function isVoiceAlertsEnabled(raw: string | undefined) {
  return raw?.trim().toLowerCase() === "true";
}

function toUtcMs(value: Date | string | number | null | undefined) {
  if (value == null || value === "") {
    return null;
  }
  const utcMs =
    typeof value === "number"
      ? value
      : value instanceof Date
        ? value.getTime()
        : Date.parse(String(value));
  return Number.isFinite(utcMs) ? utcMs : null;
}

type IstanbulWall = {
  date: string;
  secondsOfDay: number;
};

function istanbulWall(utcMs: number): IstanbulWall {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(utcMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    secondsOfDay:
      Number(parts.hour) * 3600 +
      Number(parts.minute) * 60 +
      Number(parts.second),
  };
}

export function remainingMsBeforePickup(
  pickupAt: Date | string | number | null | undefined,
  decidedAt: Date | string | number | null | undefined,
) {
  const pickupMs = toUtcMs(pickupAt);
  const decidedMs = toUtcMs(decidedAt);
  if (pickupMs == null || decidedMs == null) {
    return null;
  }
  return pickupMs - decidedMs;
}

/** Created/confirmed → pickup is 120 minutes or less. */
export function isUrgentVoiceAlert(
  pickupAt: Date | string | number | null | undefined,
  decidedAt: Date | string | number | null | undefined,
) {
  const remainingMs = remainingMsBeforePickup(pickupAt, decidedAt);
  if (remainingMs == null) {
    return false;
  }
  return remainingMs <= URGENT_VOICE_ALERT_WINDOW_MS;
}

/**
 * Created/confirmed at 00:01–08:00 Istanbul, pickup same Istanbul calendar
 * day strictly before 10:00.
 */
export function isOvernightMorningVoiceAlert(
  pickupAt: Date | string | number | null | undefined,
  decidedAt: Date | string | number | null | undefined,
) {
  const pickupMs = toUtcMs(pickupAt);
  const decidedMs = toUtcMs(decidedAt);
  if (pickupMs == null || decidedMs == null) {
    return false;
  }
  const created = istanbulWall(decidedMs);
  const pickup = istanbulWall(pickupMs);
  const inNightWindow =
    created.secondsOfDay >= NIGHT_WINDOW_START_SECONDS &&
    created.secondsOfDay <= NIGHT_WINDOW_END_SECONDS;
  const morningPickup = pickup.secondsOfDay < MORNING_PICKUP_LIMIT_SECONDS;
  return inNightWindow && created.date === pickup.date && morningPickup;
}

/**
 * Retired: creation-time emergency/night rings no longer fire.
 * Historical windows remain in isUrgentVoiceAlert / isOvernightMorningVoiceAlert.
 * Assignment reminders live in lib/ops/assignment-alarm*.
 */
export function shouldPlaceVoiceAlert(
  pickupAt: Date | string | number | null | undefined,
  decidedAt: Date | string | number | null | undefined,
) {
  void pickupAt;
  void decidedAt;
  return false;
}

export function isConfirmedReservationForVoiceAlert(input: {
  status: string | null | undefined;
  paymentMethod: string | null | undefined;
  paymentStatus: string | null | undefined;
  deletedAt?: Date | string | null;
}) {
  if (input.deletedAt) {
    return false;
  }
  if (input.status !== "confirmed") {
    return false;
  }
  return input.paymentMethod === "cash" || input.paymentStatus === "paid";
}

export type VoiceAlertDecision =
  | { action: "call" }
  | { action: "skip"; reason: string };

export function decideEmergencyVoiceAlert(input: {
  enabled: boolean;
  pickupAt: Date | string | number | null | undefined;
  decidedAt: Date | string | number | null | undefined;
  status: string | null | undefined;
  paymentMethod: string | null | undefined;
  paymentStatus: string | null | undefined;
  deletedAt?: Date | string | null;
  alreadyStarted: boolean;
}): VoiceAlertDecision {
  void input.enabled;
  void input.pickupAt;
  void input.decidedAt;
  if (input.alreadyStarted) {
    return { action: "skip", reason: "already_started" };
  }
  if (!isConfirmedReservationForVoiceAlert(input)) {
    return { action: "skip", reason: "not_confirmed" };
  }
  return { action: "skip", reason: "creation_call_retired" };
}
