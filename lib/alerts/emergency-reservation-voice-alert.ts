import "server-only";

import { query } from "@/lib/db/postgres";
import {
  readTwilioVoiceConfig,
  startTwilioVoiceCall,
  type TwilioVoiceConfig,
} from "@/lib/alerts/twilio-voice";
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

async function claimVoiceAlert(reservationId: string) {
  const result = await query<{ reservation_id: string }>(
    `INSERT INTO reservation_voice_alerts (
        reservation_id,
        claimed_at,
        attempt_count
     ) VALUES ($1, NOW(), 1)
     ON CONFLICT (reservation_id) DO UPDATE
     SET claimed_at = NOW(),
         attempt_count = reservation_voice_alerts.attempt_count + 1,
         last_error = NULL
     WHERE reservation_voice_alerts.started_at IS NULL
       AND (
         reservation_voice_alerts.claimed_at IS NULL
         OR reservation_voice_alerts.claimed_at < NOW() - INTERVAL '2 minutes'
       )
     RETURNING reservation_id`,
    [reservationId],
  );
  return result.rows[0]?.reservation_id ?? null;
}

async function markVoiceAlertStarted(reservationId: string, callSid: string) {
  await query(
    `UPDATE reservation_voice_alerts
     SET started_at = NOW(),
         twilio_call_sid = $2,
         last_error = NULL
     WHERE reservation_id = $1
       AND started_at IS NULL`,
    [reservationId, callSid],
  );
}

async function releaseVoiceAlertClaim(reservationId: string, error: string) {
  await query(
    `UPDATE reservation_voice_alerts
     SET claimed_at = NULL,
         last_error = $2
     WHERE reservation_id = $1
       AND started_at IS NULL`,
    [reservationId, error],
  );
}

function logVoiceAlert(
  reservationId: string,
  extra: Record<string, string | boolean | undefined>,
) {
  console.info("[voice-alert]", { reservationId, ...extra });
}

/**
 * Best-effort emergency ring. Never throws to the reservation flow.
 * Real Twilio calls happen only when TWILIO_VOICE_ALERTS_ENABLED=true.
 */
export async function maybeStartEmergencyReservationVoiceAlert(
  reservationId: string,
  options?: {
    env?: Record<string, string | undefined>;
    startCall?: typeof startTwilioVoiceCall;
    readConfig?: (
      env: Record<string, string | undefined>,
    ) => TwilioVoiceConfig | null;
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
    if (decision.action === "skip") {
      logVoiceAlert(id, { started: false, reason: decision.reason });
      return { ok: true, started: false, reason: decision.reason };
    }

    const readConfig = options?.readConfig ?? readTwilioVoiceConfig;
    const config = readConfig(env);
    if (!config) {
      logVoiceAlert(id, { started: false, reason: "missing_config" });
      return { ok: true, started: false, reason: "missing_config" };
    }

    const claimed = await claimVoiceAlert(id);
    if (!claimed) {
      logVoiceAlert(id, { started: false, reason: "already_claimed" });
      return { ok: true, started: false, reason: "already_claimed" };
    }

    const startCall = options?.startCall ?? startTwilioVoiceCall;
    const result = await startCall(config);
    if (!result.ok) {
      await releaseVoiceAlertClaim(id, result.error);
      logVoiceAlert(id, { started: false, reason: result.error });
      return { ok: false, error: result.error };
    }

    await markVoiceAlertStarted(id, result.callSid);
    logVoiceAlert(id, { started: true });
    return { ok: true, started: true };
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
