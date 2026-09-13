export const ASSIGNMENT_ALARM_MAX_ATTEMPTS = 4;
export const ASSIGNMENT_ALARM_STALE_CLAIM_MS = 5 * 60 * 1000;
export const ASSIGNMENT_ALARM_RETRY_DELAYS_MS = [
  4 * 60 * 1000,
  8 * 60 * 1000,
  16 * 60 * 1000,
] as const;

export const ASSIGNMENT_ALARM_NON_RETRY_VOICE_STATUSES = [
  "busy",
  "no-answer",
  "no_answer",
  "canceled",
  "cancelled",
  "rejected",
  "completed",
] as const;

export type AssignmentAlarmDeliveryStatus =
  | "claimed"
  | "sent"
  | "failed"
  | "dry_run";

export type AssignmentAlarmChannelRow = {
  channel: string;
  status: AssignmentAlarmDeliveryStatus;
  attemptCount: number;
  nextRetryAt: Date | null;
  attemptedAt?: Date | null;
};

export function isSuccessfulVoiceSubmission(input: {
  ok: boolean;
  callSid?: string | null;
}): input is { ok: true; callSid: string } {
  return input.ok && Boolean(input.callSid?.startsWith("CA"));
}

export function assignmentAlarmPersistedProviderReference(delivered: {
  providerReference?: string | null;
  reference?: string | null;
  callSid?: string | null;
}) {
  const raw =
    delivered.providerReference ?? delivered.reference ?? delivered.callSid ?? null;
  const value = raw?.trim() || null;
  return value;
}

export function shouldRetryVoiceOutcome(input: {
  submitted: boolean;
  callSid?: string | null;
  laterStatus?: string | null;
}) {
  if (input.submitted && input.callSid?.startsWith("CA")) {
    return false;
  }
  const later = (input.laterStatus ?? "").trim().toLowerCase();
  if (
    later &&
    (ASSIGNMENT_ALARM_NON_RETRY_VOICE_STATUSES as readonly string[]).includes(
      later,
    )
  ) {
    return false;
  }
  return !input.submitted;
}

export function nextAssignmentAlarmRetryAt(
  attemptCount: number,
  now: Date,
): Date | null {
  const delayMs = ASSIGNMENT_ALARM_RETRY_DELAYS_MS[attemptCount - 1];
  if (delayMs == null || attemptCount >= ASSIGNMENT_ALARM_MAX_ATTEMPTS) {
    return null;
  }
  return new Date(now.getTime() + delayMs);
}

export function isAssignmentAlarmChannelSettled(
  row: AssignmentAlarmChannelRow,
) {
  return row.status === "sent" || row.status === "dry_run";
}

export function isAssignmentAlarmRetryDue(
  row: AssignmentAlarmChannelRow,
  now: Date,
) {
  if (isAssignmentAlarmChannelSettled(row)) {
    return false;
  }
  if (row.attemptCount >= ASSIGNMENT_ALARM_MAX_ATTEMPTS) {
    return false;
  }
  if (row.status === "claimed") {
    const attemptedAt = row.attemptedAt?.getTime();
    return (
      attemptedAt != null &&
      now.getTime() - attemptedAt >= ASSIGNMENT_ALARM_STALE_CLAIM_MS
    );
  }
  if (row.status !== "failed") {
    return false;
  }
  if (!row.nextRetryAt) {
    return false;
  }
  return row.nextRetryAt.getTime() <= now.getTime();
}

export function selectAssignmentAlarmChannelActions<
  K extends string,
>(
  channels: readonly K[],
  rows: readonly AssignmentAlarmChannelRow[],
  now: Date,
): { channel: K; action: "attempt" | "skip" }[] {
  return channels.map((channel) => {
    const row = rows.find((item) => item.channel === channel);
    if (!row) {
      return { channel, action: "attempt" as const };
    }
    if (isAssignmentAlarmChannelSettled(row)) {
      return { channel, action: "skip" as const };
    }
    if (isAssignmentAlarmRetryDue(row, now)) {
      return { channel, action: "attempt" as const };
    }
    return { channel, action: "skip" as const };
  });
}
