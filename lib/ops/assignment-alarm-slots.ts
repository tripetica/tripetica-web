export const ALARM_LEAD_MS = 2 * 60 * 60 * 1000;
export const URGENT_THRESHOLD_MS = 60 * 60 * 1000;
export const NORMAL_INTERVAL_MS = 30 * 60 * 1000;
export const URGENT_INTERVAL_MS = 10 * 60 * 1000;
const CREATED_AT_SLOT_SLACK_MS = 60 * 1000;

export const NORMAL_SLOT_OFFSETS_MS = [
  120 * 60 * 1000,
  90 * 60 * 1000,
] as const;

export const URGENT_SLOT_OFFSETS_MS = [
  60 * 60 * 1000,
  50 * 60 * 1000,
  40 * 60 * 1000,
  30 * 60 * 1000,
  20 * 60 * 1000,
  10 * 60 * 1000,
] as const;

export type AssignmentAlarmUrgency = "normal" | "urgent";

export type DueAssignmentAlarmSlot = {
  key: string;
  offsetMs: number;
  slotTime: Date;
  remainingMs: number;
  urgency: AssignmentAlarmUrgency;
  kind: "planned" | "catchup" | "followup";
};

export function assignmentAlarmUrgency(
  remainingMs: number,
): AssignmentAlarmUrgency {
  return remainingMs <= URGENT_THRESHOLD_MS ? "urgent" : "normal";
}

export function reminderSlotKey(pickupAt: Date, suffix: string) {
  return `${pickupAt.toISOString()}:${suffix}`;
}

export function plannedSlotOffsetMs(): number[] {
  return [...NORMAL_SLOT_OFFSETS_MS, ...URGENT_SLOT_OFFSETS_MS];
}

function slotAppliesToReservation(
  slotTimeMs: number,
  createdAtMs: number,
) {
  return createdAtMs <= slotTimeMs + CREATED_AT_SLOT_SLACK_MS;
}

export function isInsideAssignmentAlarmWindow(now: Date, pickupAt: Date) {
  const remainingMs = pickupAt.getTime() - now.getTime();
  return remainingMs > 0 && remainingMs <= ALARM_LEAD_MS;
}

export function wasCreatedInsideAlarmWindow(createdAt: Date, pickupAt: Date) {
  return createdAt.getTime() > pickupAt.getTime() - ALARM_LEAD_MS;
}

export function nextLateCreatedIntervalMs(remainingMs: number) {
  return remainingMs <= URGENT_THRESHOLD_MS
    ? URGENT_INTERVAL_MS
    : NORMAL_INTERVAL_MS;
}

export function lateCreatedAssignmentAlarmSlots(
  pickupAt: Date,
  createdAt: Date,
): Omit<DueAssignmentAlarmSlot, "remainingMs">[] {
  const pickupMs = pickupAt.getTime();
  const slots: Omit<DueAssignmentAlarmSlot, "remainingMs">[] = [];
  let slotTimeMs = createdAt.getTime();
  while (slotTimeMs < pickupMs) {
    const offsetMs = pickupMs - slotTimeMs;
    if (offsetMs <= 0) {
      break;
    }
    const remainingMinutes = Math.round(offsetMs / 60_000);
    const isFirst = slots.length === 0;
    slots.push({
      key: reminderSlotKey(
        pickupAt,
        isFirst ? "catchup" : `late-tminus-${remainingMinutes}`,
      ),
      offsetMs,
      slotTime: new Date(slotTimeMs),
      urgency: assignmentAlarmUrgency(offsetMs),
      kind: isFirst ? "catchup" : "followup",
    });
    slotTimeMs += nextLateCreatedIntervalMs(offsetMs);
  }
  return slots;
}

export function lateCreatedRemainingMinutes(
  pickupAt: Date,
  createdAt: Date,
) {
  return lateCreatedAssignmentAlarmSlots(pickupAt, createdAt).map((slot) =>
    Math.round(slot.offsetMs / 60_000),
  );
}

function selectDuePlannedSlot(input: {
  now: Date;
  pickupAt: Date;
  createdAt: Date;
  deliveredKeys: readonly string[];
  remainingMs: number;
}): DueAssignmentAlarmSlot | null {
  const delivered = new Set(input.deliveredKeys);
  const duePlanned: DueAssignmentAlarmSlot[] = [];
  for (const offsetMs of plannedSlotOffsetMs()) {
    const slotTime = new Date(input.pickupAt.getTime() - offsetMs);
    if (slotTime.getTime() > input.now.getTime()) {
      continue;
    }
    if (!slotAppliesToReservation(slotTime.getTime(), input.createdAt.getTime())) {
      continue;
    }
    duePlanned.push({
      key: reminderSlotKey(input.pickupAt, `tminus-${offsetMs / 60000}`),
      offsetMs,
      slotTime,
      remainingMs: input.remainingMs,
      urgency: offsetMs <= URGENT_THRESHOLD_MS ? "urgent" : "normal",
      kind: "planned",
    });
  }
  if (duePlanned.length === 0) {
    return null;
  }
  duePlanned.sort((a, b) => b.slotTime.getTime() - a.slotTime.getTime());
  const latest = duePlanned[0];
  if (!latest || delivered.has(latest.key)) {
    return null;
  }
  return latest;
}

function selectDueLateCreatedSlot(input: {
  now: Date;
  pickupAt: Date;
  createdAt: Date;
  deliveredKeys: readonly string[];
  remainingMs: number;
}): DueAssignmentAlarmSlot | null {
  const delivered = new Set(input.deliveredKeys);
  const due = lateCreatedAssignmentAlarmSlots(input.pickupAt, input.createdAt)
    .filter((slot) => slot.slotTime.getTime() <= input.now.getTime())
    .map((slot) => ({
      ...slot,
      remainingMs: input.remainingMs,
    }));
  if (due.length === 0) {
    return null;
  }
  const latest = due[due.length - 1];
  if (!latest || delivered.has(latest.key)) {
    return null;
  }
  return latest;
}

export function selectDueAssignmentAlarmSlot(input: {
  now: Date;
  pickupAt: Date;
  createdAt: Date;
  deliveredKeys: readonly string[];
}): DueAssignmentAlarmSlot | null {
  const remainingMs = input.pickupAt.getTime() - input.now.getTime();
  if (remainingMs <= 0 || remainingMs > ALARM_LEAD_MS) {
    return null;
  }
  if (wasCreatedInsideAlarmWindow(input.createdAt, input.pickupAt)) {
    return selectDueLateCreatedSlot({ ...input, remainingMs });
  }
  return selectDuePlannedSlot({ ...input, remainingMs });
}
