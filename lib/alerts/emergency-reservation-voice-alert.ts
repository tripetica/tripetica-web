import "server-only";

import { query } from "@/lib/db/postgres";
import {
  decideEmergencyVoiceAlert,
  isVoiceAlertsEnabled,
} from "@/lib/alerts/voice-alert-policy";

type ReservationVoiceAlertRow = {
  id: string;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  pickup_at: Date | null;
  created_at: Date;
  confirmed_at: Date | null;
  deleted_at: Date | null;
  already_started: boolean;
};

export type EmergencyVoiceAlertOutcome =
  | { ok: true; started: true }
  | { ok: true; started: false; reason: string }
  | { ok: false; error: string };

async function loadReservationForVoiceAlert(reservationId: string) {
  const result = await query<ReservationVoiceAlertRow>(
    `SELECT
        r.id,
        r.status,
        r.payment_method,
        r.payment_status,
        r.pickup_at,
        r.created_at,
        r.confirmed_at,
        r.deleted_at,
        EXISTS (
          SELECT 1
          FROM reservation_voice_alerts a
          WHERE a.reservation_id = r.id
            AND a.started_at IS NOT NULL
        ) AS already_started
     FROM reservations r
     WHERE r.id = $1`,
    [reservationId],
  );
  return result.rows[0] ?? null;
}

function logVoiceAlert(
  reservationId: string,
  extra: Record<string, string | boolean | undefined>,
) {
  console.info("[voice-alert]", { reservationId, ...extra });
}

/**
 * Retired reservation-created emergency ring. The assignment alarm scheduler
 * owns operational phone reminders. This helper never places a Twilio call.
 */
export async function maybeStartEmergencyReservationVoiceAlert(
  reservationId: string,
  options?: {
    env?: Record<string, string | undefined>;
  },
): Promise<EmergencyVoiceAlertOutcome> {
  const id = reservationId.trim();
  if (!id) {
    return { ok: true, started: false, reason: "missing_reservation_id" };
  }

  try {
    const env = options?.env ?? process.env;
    const row = await loadReservationForVoiceAlert(id);
    if (!row) {
      return { ok: true, started: false, reason: "not_found" };
    }

    const decision = decideEmergencyVoiceAlert({
      enabled: isVoiceAlertsEnabled(env.TWILIO_VOICE_ALERTS_ENABLED),
      pickupAt: row.pickup_at,
      decidedAt: row.confirmed_at ?? row.created_at,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      deletedAt: row.deleted_at,
      alreadyStarted: row.already_started,
    });
    const reason =
      decision.action === "skip" ? decision.reason : "creation_call_retired";
    logVoiceAlert(id, { started: false, reason });
    return { ok: true, started: false, reason };
  } catch (error) {
    console.error("[voice-alert] unexpected failure", {
      reservationId: id,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : "unexpected",
    });
    return { ok: false, error: "unexpected" };
  }
}
