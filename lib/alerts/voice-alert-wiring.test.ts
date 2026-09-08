import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("confirmation hooks start the voice alert after commit, not inside the reservation transaction", () => {
  const complete = source("app/api/booking/complete/route.ts");
  const callback = source("app/api/payments/turinvoice/callback/route.ts");
  const insert = source("lib/booking/complete-reservation.ts");
  assert.match(complete, /maybeStartEmergencyReservationVoiceAlert/);
  assert.match(callback, /maybeStartEmergencyReservationVoiceAlert/);
  assert.match(complete, /after\(async \(\) => \{/);
  assert.doesNotMatch(insert, /maybeStartEmergencyReservationVoiceAlert/);
});

test("voice-alert migration is additive and does not rewrite reservations", () => {
  const sql = source("db/migrations/029_reservation_voice_alerts.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS reservation_voice_alerts/);
  assert.doesNotMatch(sql, /ALTER TABLE reservations/);
  assert.doesNotMatch(sql, /DROP TABLE/);
});

test("TwiML route only hangs up", () => {
  const route = source("app/api/twilio/voice-alert/twiml/route.ts");
  assert.match(route, /VOICE_ALERT_TWIML/);
  assert.doesNotMatch(route, /Say|Gather|Play|Record/);
});
