import { loadDevelopmentEnv } from "./load-env";
import { assertDevAssignmentAlarmRuntime } from "../lib/ops/assignment-alarm-dev-guard";

loadDevelopmentEnv();
assertDevAssignmentAlarmRuntime();

const PROBE_KEY = "dev-ring-once";

function maskCallSid(callSid: string) {
  if (callSid.length < 8) {
    return "CA…";
  }
  return `${callSid.slice(0, 2)}…${callSid.slice(-4)}`;
}

async function main() {
  if (process.env.ASSIGNMENT_ALARM_VOICE_ENABLED !== "true") {
    throw new Error("Set ASSIGNMENT_ALARM_VOICE_ENABLED=true for this one-shot DEV ring test.");
  }

  const { query, getPool } = await import("../lib/db/postgres");
  const { buildTwilioCallRequest, readTwilioVoiceConfig, startTwilioVoiceCall } =
    await import("../lib/alerts/twilio-voice");
  const { VOICE_ALERT_TWIML } = await import("../lib/alerts/voice-alert-policy");
  const { isSuccessfulVoiceSubmission } = await import(
    "../lib/ops/assignment-alarm-retry"
  );

  try {
    const claimed = await query<{ probe_key: string }>(
      `INSERT INTO assignment_alarm_dev_probes (probe_key, status)
       VALUES ($1, 'claimed')
       ON CONFLICT (probe_key) DO NOTHING
       RETURNING probe_key`,
      [PROBE_KEY],
    );
    if (!claimed.rows[0]) {
      const existing = await query<{ status: string }>(
        `SELECT status FROM assignment_alarm_dev_probes WHERE probe_key = $1`,
        [PROBE_KEY],
      );
      throw new Error(
        `DEV ring probe already ${existing.rows[0]?.status ?? "exists"}; not calling again.`,
      );
    }

    const config = readTwilioVoiceConfig();
    if (!config) {
      await query(
        `UPDATE assignment_alarm_dev_probes
         SET status = 'failed', finished_at = NOW(), error = 'twilio_config_missing'
         WHERE probe_key = $1`,
        [PROBE_KEY],
      );
      throw new Error("Twilio voice config is incomplete.");
    }

    const twiml =
      new URLSearchParams(buildTwilioCallRequest(config).body).get("Twiml") ?? "";
    if (twiml !== VOICE_ALERT_TWIML || /Say/i.test(twiml)) {
      await query(
        `UPDATE assignment_alarm_dev_probes
         SET status = 'failed', finished_at = NOW(), error = 'twiml_not_ring_only'
         WHERE probe_key = $1`,
        [PROBE_KEY],
      );
      throw new Error("Ring-only TwiML check failed; no call placed.");
    }

    const result = await startTwilioVoiceCall(config);
    if (!isSuccessfulVoiceSubmission(result)) {
      const error = result.ok ? "twilio_sid_missing" : result.error;
      await query(
        `UPDATE assignment_alarm_dev_probes
         SET status = 'failed', finished_at = NOW(), error = $2
         WHERE probe_key = $1`,
        [PROBE_KEY, error],
      );
      throw new Error(`Twilio submission failed: ${error}`);
    }

    await query(
      `UPDATE assignment_alarm_dev_probes
       SET status = 'sent',
           finished_at = NOW(),
           provider_reference = $2
       WHERE probe_key = $1`,
      [PROBE_KEY, result.callSid],
    );
    console.log(
      `DEV ring probe submitted status=sent sid=${maskCallSid(result.callSid)}`,
    );
  } finally {
    await getPool().end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
