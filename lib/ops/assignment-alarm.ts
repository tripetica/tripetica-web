import "server-only";

import { bookingCopy } from "@/lib/booking/copy";
import { BOOKING_TIME_ZONE } from "@/lib/booking/istanbul-time";
import { query } from "@/lib/db/postgres";
import {
  readTwilioVoiceConfig,
  startTwilioVoiceCall,
} from "@/lib/alerts/twilio-voice";
import {
  reservationMailFromAddress,
  sendReservationSmtpMail,
} from "@/lib/mail/smtp";
import {
  ASSIGNMENT_ALARM_CHANNELS,
  firedAssignmentAlarmSlots,
  runIndependentAssignmentAlarmChannels,
  type AssignmentAlarmChannel,
  type AssignmentAlarmChannelResult,
} from "@/lib/ops/assignment-alarm-channels";
import {
  assignmentAlarmEmailRecipient,
  assignmentAlarmVoiceEnabled,
} from "@/lib/ops/assignment-alarm-config";
import { buildAssignmentAlarmEmail } from "@/lib/ops/assignment-alarm-copy";
import { evaluateAssignmentAlarm } from "@/lib/ops/assignment-alarm-decision";
import {
  assignmentAlarmUrgency,
  type DueAssignmentAlarmSlot,
} from "@/lib/ops/assignment-alarm-slots";
import {
  ASSIGNMENT_ALARM_MAX_ATTEMPTS,
  assignmentAlarmPersistedProviderReference,
  isSuccessfulVoiceSubmission,
  nextAssignmentAlarmRetryAt,
  selectAssignmentAlarmChannelActions,
  type AssignmentAlarmChannelRow,
  type AssignmentAlarmDeliveryStatus,
} from "@/lib/ops/assignment-alarm-retry";
import {
  missingAssignmentParts,
  type OperationAssignmentState,
} from "@/lib/ops/assignment-completeness";
import { localizedPath } from "@/lib/i18n/path";

export {
  ASSIGNMENT_ALARM_CHANNELS,
  type AssignmentAlarmChannel,
} from "@/lib/ops/assignment-alarm-channels";
export {
  PRODUCTION_ASSIGNMENT_ALARM_EMAIL_TO,
  assignmentAlarmEmailRecipient,
  assignmentAlarmVoiceEnabled,
  isProductionAssignmentAlarmEnvironment,
} from "@/lib/ops/assignment-alarm-config";

type CandidateRow = {
  id: string;
  reservation_code: string;
  status: string;
  deleted_at: Date | null;
  created_at: Date;
  pickup_at: Date;
  accepted_partner_id: string | null;
  assigned_driver_kind: string | null;
  assigned_driver_id: string | null;
  assigned_driver_snapshot: unknown;
  assigned_vehicle_kind: string | null;
  assigned_vehicle_id: string | null;
  assigned_vehicle_snapshot: unknown;
  service_type: string | null;
  pickup_name_customer: string | null;
  dropoff_name_customer: string | null;
  vehicle_label_customer: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  driver_task_stage: string | null;
};

type DeliveryRow = {
  id: string;
  reminder_slot: string;
  channel: string;
  status: AssignmentAlarmDeliveryStatus;
  attempt_count: number;
  next_retry_at: Date | null;
  attempted_at: Date;
};

function assignmentStateFromRow(row: CandidateRow): OperationAssignmentState {
  return {
    acceptedPartnerId: row.accepted_partner_id,
    assignedDriverKind: row.assigned_driver_kind,
    assignedDriverId: row.assigned_driver_id,
    assignedDriverSnapshot: row.assigned_driver_snapshot,
    assignedVehicleKind: row.assigned_vehicle_kind,
    assignedVehicleId: row.assigned_vehicle_id,
    assignedVehicleSnapshot: row.assigned_vehicle_snapshot,
  };
}

function serviceTypeLabel(serviceType: string | null) {
  if (
    serviceType === "transfer" ||
    serviceType === "hourly" ||
    serviceType === "tour"
  ) {
    return bookingCopy.tr.services[serviceType];
  }
  return serviceType?.trim() || "Rezervasyon";
}

function customerName(first: string | null, last: string | null) {
  return [first, last].map((part) => part?.trim() || "").filter(Boolean).join(" ") || "—";
}

function formatPickupAt(pickupAt: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: BOOKING_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(pickupAt);
}

function opsHref(reservationId: string) {
  const origin = (process.env.APP_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (!origin) {
    return null;
  }
  return `${origin}${localizedPath("tr", `/ops/reservations/${reservationId}`)}`;
}

function slotFromExistingKey(
  reminderSlot: string,
  pickupAt: Date,
  now: Date,
): DueAssignmentAlarmSlot {
  const remainingMs = pickupAt.getTime() - now.getTime();
  return {
    key: reminderSlot,
    offsetMs: remainingMs,
    slotTime: now,
    remainingMs,
    urgency: assignmentAlarmUrgency(remainingMs),
    kind: reminderSlot.includes(":catchup")
      ? "catchup"
      : reminderSlot.includes(":late-")
        ? "followup"
        : "planned",
  };
}

function channelRowFromDelivery(row: DeliveryRow): AssignmentAlarmChannelRow {
  return {
    channel: row.channel,
    status: row.status,
    attemptCount: row.attempt_count,
    nextRetryAt: row.next_retry_at,
    attemptedAt: row.attempted_at,
  };
}

export async function loadFiredAssignmentAlarmKeys(reservationId: string) {
  const result = await query<{ reminder_slot: string }>(
    `SELECT reminder_slot
     FROM reservation_assignment_alarm_deliveries
     WHERE reservation_id = $1`,
    [reservationId],
  );
  return firedAssignmentAlarmSlots(result.rows);
}

export async function loadAssignmentAlarmDeliveries(reservationId: string) {
  const result = await query<DeliveryRow>(
    `SELECT id, reminder_slot, channel, status, attempt_count, next_retry_at, attempted_at
     FROM reservation_assignment_alarm_deliveries
     WHERE reservation_id = $1`,
    [reservationId],
  );
  return result.rows;
}

export async function claimAssignmentAlarmDelivery(input: {
  reservationId: string;
  reminderSlot: string;
  channel: AssignmentAlarmChannel;
}) {
  const inserted = await query<{ id: string }>(
    `INSERT INTO reservation_assignment_alarm_deliveries (
        reservation_id, reminder_slot, channel, status, attempt_count
     ) VALUES ($1, $2, $3, 'claimed', 1)
     ON CONFLICT (reservation_id, reminder_slot, channel) DO NOTHING
     RETURNING id`,
    [input.reservationId, input.reminderSlot, input.channel],
  );
  if (inserted.rows[0]?.id) {
    return inserted.rows[0].id;
  }
  const reclaimed = await query<{ id: string }>(
    `UPDATE reservation_assignment_alarm_deliveries
     SET status = 'claimed',
         attempted_at = NOW(),
         finished_at = NULL,
         provider_reference = NULL,
         error = NULL,
         attempt_count = attempt_count + 1
     WHERE reservation_id = $1
       AND reminder_slot = $2
       AND channel = $3
       AND attempt_count < $4
       AND (
         (
           status = 'failed'
           AND next_retry_at IS NOT NULL
           AND next_retry_at <= NOW()
         )
         OR (
           status = 'claimed'
           AND attempted_at < NOW() - INTERVAL '5 minutes'
         )
       )
     RETURNING id`,
    [
      input.reservationId,
      input.reminderSlot,
      input.channel,
      ASSIGNMENT_ALARM_MAX_ATTEMPTS,
    ],
  );
  return reclaimed.rows[0]?.id ?? null;
}

async function finishAssignmentAlarmDelivery(input: {
  id: string;
  status: "sent" | "failed" | "dry_run";
  providerReference?: string | null;
  error?: string | null;
}) {
  const current = await query<{ attempt_count: number }>(
    `SELECT attempt_count
     FROM reservation_assignment_alarm_deliveries
     WHERE id = $1`,
    [input.id],
  );
  const attemptCount = current.rows[0]?.attempt_count ?? 1;
  const nextRetryAt =
    input.status === "failed"
      ? nextAssignmentAlarmRetryAt(attemptCount, new Date())
      : null;
  await query(
    `UPDATE reservation_assignment_alarm_deliveries
     SET status = $2,
         finished_at = NOW(),
         provider_reference = $3,
         error = $4,
         next_retry_at = $5
     WHERE id = $1`,
    [
      input.id,
      input.status,
      input.providerReference ?? null,
      input.error ?? null,
      nextRetryAt,
    ],
  );
}

async function sendAssignmentAlarmEmail(input: {
  reservation: CandidateRow;
  slot: DueAssignmentAlarmSlot;
  missing: ReturnType<typeof missingAssignmentParts>;
}) {
  const to = assignmentAlarmEmailRecipient();
  const bodies = buildAssignmentAlarmEmail({
    reservationCode: input.reservation.reservation_code,
    remainingMs: input.slot.remainingMs,
    urgency: input.slot.urgency,
    pickupAtLabel: formatPickupAt(input.reservation.pickup_at),
    serviceTypeLabel: serviceTypeLabel(input.reservation.service_type),
    pickup: input.reservation.pickup_name_customer?.trim() || "—",
    dropoff: input.reservation.dropoff_name_customer?.trim() || "—",
    vehicleClass: input.reservation.vehicle_label_customer?.trim() || "—",
    customerName: customerName(
      input.reservation.customer_first_name,
      input.reservation.customer_last_name,
    ),
    missing: input.missing,
    opsHref: opsHref(input.reservation.id),
  });
  if (!to) {
    return { status: "dry_run" as const, reference: null, error: null };
  }
  const messageId = `<assignment-alarm-${input.reservation.id}-${input.slot.key}-email@tripetica.com>`;
  const sent = await sendReservationSmtpMail(
    {
      to,
      subject: bodies.subject,
      text: bodies.text,
      html: bodies.html,
      from: reservationMailFromAddress(),
      messageId,
    },
    { logPrefix: "[assignment-alarm email]" },
  );
  if (!sent.ok) {
    return { status: "failed" as const, reference: null, error: sent.error };
  }
  return { status: "sent" as const, reference: messageId, error: null };
}

async function sendAssignmentAlarmVoice() {
  if (!assignmentAlarmVoiceEnabled()) {
    return { status: "dry_run" as const, reference: null, error: null };
  }
  const config = readTwilioVoiceConfig();
  if (!config) {
    return {
      status: "failed" as const,
      reference: null,
      error: "twilio_config_missing",
    };
  }
  const result = await startTwilioVoiceCall(config);
  if (!isSuccessfulVoiceSubmission(result)) {
    return {
      status: "failed" as const,
      reference: null,
      error: result.ok ? "twilio_sid_missing" : result.error,
    };
  }
  return { status: "sent" as const, reference: result.callSid, error: null };
}

export async function deliverAssignmentAlarmChannels(input: {
  reservation: CandidateRow;
  slot: DueAssignmentAlarmSlot;
  missing: ReturnType<typeof missingAssignmentParts>;
  existingRows?: AssignmentAlarmChannelRow[];
}) {
  const now = new Date();
  const actions = selectAssignmentAlarmChannelActions(
    ASSIGNMENT_ALARM_CHANNELS,
    input.existingRows ?? [],
    now,
  );
  return runIndependentAssignmentAlarmChannels(
    ASSIGNMENT_ALARM_CHANNELS,
    async (channel): Promise<AssignmentAlarmChannelResult> => {
      if (actions.find((item) => item.channel === channel)?.action === "skip") {
        return { status: "skipped", error: null };
      }
      const claimId = await claimAssignmentAlarmDelivery({
        reservationId: input.reservation.id,
        reminderSlot: input.slot.key,
        channel,
      });
      if (!claimId) {
        return { status: "skipped", error: null };
      }
      try {
        const delivered =
          channel === "email"
            ? await sendAssignmentAlarmEmail(input)
            : await sendAssignmentAlarmVoice();
        await finishAssignmentAlarmDelivery({
          id: claimId,
          status: delivered.status,
          providerReference: assignmentAlarmPersistedProviderReference(delivered),
          error: delivered.error,
        });
        return { status: delivered.status, error: delivered.error };
      } catch (error) {
        const message = error instanceof Error ? error.message : "channel_failed";
        await finishAssignmentAlarmDelivery({
          id: claimId,
          status: "failed",
          error: message,
        });
        return { status: "failed", error: message };
      }
    },
  );
}

async function reconcileExistingAssignmentAlarmSlots(
  reservation: CandidateRow,
) {
  const rows = await loadAssignmentAlarmDeliveries(reservation.id);
  const bySlot = new Map<string, DeliveryRow[]>();
  for (const row of rows) {
    const list = bySlot.get(row.reminder_slot) ?? [];
    list.push(row);
    bySlot.set(row.reminder_slot, list);
  }
  let retried = 0;
  for (const [reminderSlot, slotRows] of bySlot) {
    const slot = slotFromExistingKey(
      reminderSlot,
      reservation.pickup_at,
      new Date(),
    );
    if (slot.remainingMs <= 0) {
      continue;
    }
    const results = await deliverAssignmentAlarmChannels({
      reservation,
      slot,
      missing: missingAssignmentParts(assignmentStateFromRow(reservation)),
      existingRows: slotRows.map(channelRowFromDelivery),
    });
    if (
      ASSIGNMENT_ALARM_CHANNELS.some(
        (channel) =>
          results[channel].status === "sent" ||
          results[channel].status === "failed" ||
          results[channel].status === "dry_run",
      )
    ) {
      retried += 1;
    }
  }
  return retried;
}

async function listAssignmentAlarmCandidates() {
  const result = await query<CandidateRow>(
    `SELECT
        r.id,
        r.reservation_code,
        r.status,
        r.deleted_at,
        r.created_at,
        r.pickup_at,
        r.accepted_partner_id,
        r.assigned_driver_kind,
        r.assigned_driver_id,
        r.assigned_driver_snapshot,
        r.assigned_vehicle_kind,
        r.assigned_vehicle_id,
        r.assigned_vehicle_snapshot,
        r.service_type,
        r.pickup_name_customer,
        r.dropoff_name_customer,
        r.vehicle_label_customer,
        r.customer_first_name,
        r.customer_last_name,
        driver_task.current_stage AS driver_task_stage
     FROM reservations r
     LEFT JOIN reservation_driver_tasks driver_task
       ON driver_task.reservation_id = r.id
     WHERE r.deleted_at IS NULL
       AND r.status = 'confirmed'
       AND r.pickup_at IS NOT NULL
       AND r.pickup_at > NOW()
       AND r.pickup_at <= NOW() + INTERVAL '2 hours'
       AND (
         driver_task.current_stage IS NULL
         OR driver_task.current_stage <> 'completed'
       )
     ORDER BY r.pickup_at ASC
     LIMIT 100`,
  );
  return result.rows;
}

async function loadAssignmentAlarmReservation(reservationId: string) {
  const latest = await query<CandidateRow>(
    `SELECT
        r.id,
        r.reservation_code,
        r.status,
        r.deleted_at,
        r.created_at,
        r.pickup_at,
        r.accepted_partner_id,
        r.assigned_driver_kind,
        r.assigned_driver_id,
        r.assigned_driver_snapshot,
        r.assigned_vehicle_kind,
        r.assigned_vehicle_id,
        r.assigned_vehicle_snapshot,
        r.service_type,
        r.pickup_name_customer,
        r.dropoff_name_customer,
        r.vehicle_label_customer,
        r.customer_first_name,
        r.customer_last_name,
        driver_task.current_stage AS driver_task_stage
     FROM reservations r
     LEFT JOIN reservation_driver_tasks driver_task
       ON driver_task.reservation_id = r.id
     WHERE r.id = $1
     LIMIT 1`,
    [reservationId],
  );
  return latest.rows[0] ?? null;
}

export async function dispatchAssignmentAlarms() {
  const candidates = await listAssignmentAlarmCandidates();
  let considered = 0;
  let alarmed = 0;
  for (const row of candidates) {
    considered += 1;
    const current = await loadAssignmentAlarmReservation(row.id);
    if (!current) {
      continue;
    }
    const decisionBase = {
      now: new Date(),
      createdAt: current.created_at,
      status: current.status,
      deletedAt: current.deleted_at,
      pickupAt: current.pickup_at,
      driverTaskStage: current.driver_task_stage,
      assignment: assignmentStateFromRow(current),
    };
    const skip = evaluateAssignmentAlarm({
      ...decisionBase,
      deliveredKeys: [],
    });
    if (
      skip.action === "skip" &&
      (skip.reason === "terminal" || skip.reason === "complete")
    ) {
      continue;
    }
    alarmed += await reconcileExistingAssignmentAlarmSlots(current);
    const firedKeys = await loadFiredAssignmentAlarmKeys(current.id);
    const decision = evaluateAssignmentAlarm({
      ...decisionBase,
      now: new Date(),
      deliveredKeys: firedKeys,
    });
    if (decision.action !== "deliver") {
      continue;
    }
    await deliverAssignmentAlarmChannels({
      reservation: current,
      slot: decision.slot,
      missing: missingAssignmentParts(assignmentStateFromRow(current)),
    });
    alarmed += 1;
  }
  return { considered, alarmed };
}
