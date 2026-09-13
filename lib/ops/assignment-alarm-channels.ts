export const ASSIGNMENT_ALARM_CHANNELS = ["email", "voice"] as const;
export type AssignmentAlarmChannel = (typeof ASSIGNMENT_ALARM_CHANNELS)[number];

export type AssignmentAlarmChannelResult = {
  status: "sent" | "failed" | "dry_run" | "skipped";
  error: string | null;
};

export function firedAssignmentAlarmSlots(
  rows: readonly { reminder_slot: string }[],
) {
  return [...new Set(rows.map((row) => row.reminder_slot))];
}

export function fullyDeliveredAssignmentAlarmSlots(
  rows: readonly { reminder_slot: string; channel: string }[],
  channels: readonly string[] = ASSIGNMENT_ALARM_CHANNELS,
) {
  const bySlot = new Map<string, Set<string>>();
  for (const row of rows) {
    const delivered = bySlot.get(row.reminder_slot) ?? new Set<string>();
    delivered.add(row.channel);
    bySlot.set(row.reminder_slot, delivered);
  }
  return [...bySlot.entries()]
    .filter(([, delivered]) => channels.every((channel) => delivered.has(channel)))
    .map(([slot]) => slot);
}

export function assignmentAlarmClaimKey(
  reservationId: string,
  reminderSlot: string,
  channel: string,
) {
  return `${reservationId}\u0000${reminderSlot}\u0000${channel}`;
}

export function createMemoryAssignmentAlarmClaims() {
  const claimed = new Set<string>();
  return {
    tryClaim(reservationId: string, reminderSlot: string, channel: string) {
      const key = assignmentAlarmClaimKey(reservationId, reminderSlot, channel);
      if (claimed.has(key)) {
        return false;
      }
      claimed.add(key);
      return true;
    },
    has(reservationId: string, reminderSlot: string, channel: string) {
      return claimed.has(
        assignmentAlarmClaimKey(reservationId, reminderSlot, channel),
      );
    },
  };
}

export async function runIndependentAssignmentAlarmChannels<
  K extends string,
>(
  channels: readonly K[],
  attempt: (channel: K) => Promise<AssignmentAlarmChannelResult>,
): Promise<Record<K, AssignmentAlarmChannelResult>> {
  const results = {} as Record<K, AssignmentAlarmChannelResult>;
  await Promise.all(
    channels.map(async (channel) => {
      try {
        results[channel] = await attempt(channel);
      } catch (error) {
        results[channel] = {
          status: "failed",
          error: error instanceof Error ? error.message : "channel_failed",
        };
      }
    }),
  );
  return results;
}
