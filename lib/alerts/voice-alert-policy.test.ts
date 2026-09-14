import test from "node:test";
import assert from "node:assert/strict";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import {
  URGENT_VOICE_ALERT_WINDOW_MS,
  VOICE_ALERT_TWIML,
  decideEmergencyVoiceAlert,
  isOvernightMorningVoiceAlert,
  isUrgentVoiceAlert,
  isVoiceAlertsEnabled,
  shouldPlaceVoiceAlert,
} from "@/lib/alerts/voice-alert-policy";

function istanbul(local: string, extraMs = 0) {
  return new Date(istanbulLocalToUtcMs(local) + extraMs);
}

const confirmed = {
  status: "confirmed",
  paymentMethod: "cash" as const,
  paymentStatus: null as string | null,
  deletedAt: null,
  alreadyStarted: false,
};

test("voice alerts stay off unless the flag is exactly true", () => {
  assert.equal(isVoiceAlertsEnabled(undefined), false);
  assert.equal(isVoiceAlertsEnabled(""), false);
  assert.equal(isVoiceAlertsEnabled("false"), false);
  assert.equal(isVoiceAlertsEnabled("TRUE"), true);
  assert.equal(isVoiceAlertsEnabled("true"), true);
});

test("retired urgent window was 120 minutes or less from create/confirm to pickup", () => {
  const created = istanbul("2026-09-06T14:00");
  assert.equal(isUrgentVoiceAlert(istanbul("2026-09-06T15:30"), created), true);
  assert.equal(isUrgentVoiceAlert(istanbul("2026-09-06T16:00"), created), true);
  assert.equal(
    isUrgentVoiceAlert(new Date(created.getTime() + URGENT_VOICE_ALERT_WINDOW_MS), created),
    true,
  );
  assert.equal(
    isUrgentVoiceAlert(
      new Date(created.getTime() + URGENT_VOICE_ALERT_WINDOW_MS + 1000),
      created,
    ),
    false,
  );
  assert.equal(isUrgentVoiceAlert(istanbul("2026-09-06T17:00"), created), false);
  assert.equal(isUrgentVoiceAlert(null, created), false);
});

test("retired overnight morning rule was Istanbul 00:01-08:00 create and same-day pickup before 10:00", () => {
  const midnight = istanbul("2026-09-06T00:00");
  assert.equal(
    isOvernightMorningVoiceAlert(istanbul("2026-09-06T09:00"), new Date(midnight.getTime() + 59_000)),
    false,
  );
  assert.equal(
    isOvernightMorningVoiceAlert(istanbul("2026-09-06T09:00"), new Date(midnight.getTime() + 60_000)),
    true,
  );
  assert.equal(
    isOvernightMorningVoiceAlert(istanbul("2026-09-06T09:45"), istanbul("2026-09-06T08:00")),
    true,
  );
  assert.equal(
    isOvernightMorningVoiceAlert(
      istanbul("2026-09-06T09:45"),
      new Date(istanbul("2026-09-06T08:00").getTime() + 1000),
    ),
    false,
  );
  assert.equal(
    isOvernightMorningVoiceAlert(istanbul("2026-09-06T09:59"), istanbul("2026-09-06T03:00")),
    true,
  );
  assert.equal(
    isOvernightMorningVoiceAlert(istanbul("2026-09-06T10:00"), istanbul("2026-09-06T03:00")),
    false,
  );
  assert.equal(
    isOvernightMorningVoiceAlert(istanbul("2026-09-06T10:30"), istanbul("2026-09-06T03:00")),
    false,
  );
});

test("creation-time voice calls are retired for the old urgent and overnight windows", () => {
  const cases: Array<[string, string, boolean]> = [
    ["2026-09-06T14:00", "2026-09-06T15:30", true],
    ["2026-09-06T14:00", "2026-09-06T17:00", false],
    ["2026-09-06T23:30", "2026-09-07T00:45", true],
    ["2026-09-06T00:15", "2026-09-06T08:30", true],
    ["2026-09-06T03:00", "2026-09-06T09:45", true],
    ["2026-09-06T03:00", "2026-09-06T10:30", false],
    ["2026-09-06T07:50", "2026-09-06T09:30", true],
    ["2026-09-06T08:15", "2026-09-06T09:30", true],
    ["2026-09-06T08:15", "2026-09-06T11:00", false],
  ];
  for (const [created, pickup, historicallyWouldCall] of cases) {
    const createdAt = istanbul(created);
    const pickupAt = istanbul(pickup);
    assert.equal(
      isUrgentVoiceAlert(pickupAt, createdAt) ||
        isOvernightMorningVoiceAlert(pickupAt, createdAt),
      historicallyWouldCall,
      `historical window ${created} / ${pickup}`,
    );
    assert.equal(shouldPlaceVoiceAlert(pickupAt, createdAt), false);
    assert.deepEqual(
      decideEmergencyVoiceAlert({
        ...confirmed,
        enabled: true,
        decidedAt: createdAt,
        pickupAt,
      }),
      { action: "skip", reason: "creation_call_retired" },
    );
  }
});

test("overnight rule uses Istanbul calendar day, not UTC day", () => {
  // 21:15 UTC = 00:15 Istanbul next calendar day.
  const createdUtc = new Date("2026-09-05T21:15:00.000Z");
  const pickupUtc = new Date("2026-09-06T05:30:00.000Z"); // 08:30 Istanbul
  assert.equal(isOvernightMorningVoiceAlert(pickupUtc, createdUtc), true);
  assert.equal(createdUtc.getUTCDate() === pickupUtc.getUTCDate(), false);
  assert.equal(shouldPlaceVoiceAlert(pickupUtc, createdUtc), false);
});

test("retired creation call never returns action call", () => {
  assert.deepEqual(
    decideEmergencyVoiceAlert({
      ...confirmed,
      enabled: true,
      decidedAt: istanbul("2026-09-06T14:00"),
      pickupAt: istanbul("2026-09-06T15:30"),
    }),
    { action: "skip", reason: "creation_call_retired" },
  );
  assert.deepEqual(
    decideEmergencyVoiceAlert({
      ...confirmed,
      enabled: false,
      decidedAt: istanbul("2026-09-06T14:00"),
      pickupAt: istanbul("2026-09-06T15:30"),
    }),
    { action: "skip", reason: "creation_call_retired" },
  );
  assert.deepEqual(
    decideEmergencyVoiceAlert({
      ...confirmed,
      enabled: true,
      decidedAt: istanbul("2026-09-06T14:00"),
      pickupAt: istanbul("2026-09-06T17:00"),
    }),
    { action: "skip", reason: "creation_call_retired" },
  );
  assert.deepEqual(
    decideEmergencyVoiceAlert({
      ...confirmed,
      enabled: true,
      status: "payment_pending",
      decidedAt: istanbul("2026-09-06T14:00"),
      pickupAt: istanbul("2026-09-06T15:30"),
    }),
    { action: "skip", reason: "not_confirmed" },
  );
  assert.deepEqual(
    decideEmergencyVoiceAlert({
      ...confirmed,
      enabled: true,
      alreadyStarted: true,
      decidedAt: istanbul("2026-09-06T14:00"),
      pickupAt: istanbul("2026-09-06T15:30"),
    }),
    { action: "skip", reason: "already_started" },
  );
  assert.deepEqual(
    decideEmergencyVoiceAlert({
      ...confirmed,
      enabled: true,
      paymentMethod: "sbp",
      paymentStatus: "paid",
      decidedAt: istanbul("2026-09-06T03:00"),
      pickupAt: istanbul("2026-09-06T09:45"),
    }),
    { action: "skip", reason: "creation_call_retired" },
  );
});

test("TwiML only hangs up", () => {
  assert.match(VOICE_ALERT_TWIML, /<Hangup\/>/);
  assert.doesNotMatch(VOICE_ALERT_TWIML, /Say|Gather|Play|Record/i);
});
