import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASSIGNMENT_ALARM_CHANNELS,
  createMemoryAssignmentAlarmClaims,
  firedAssignmentAlarmSlots,
  fullyDeliveredAssignmentAlarmSlots,
  runIndependentAssignmentAlarmChannels,
} from "@/lib/ops/assignment-alarm-channels";
import {
  PRODUCTION_ASSIGNMENT_ALARM_EMAIL_TO,
  assignmentAlarmEmailRecipient,
  assignmentAlarmVoiceEnabled,
  isProductionAssignmentAlarmEnvironment,
} from "@/lib/ops/assignment-alarm-config";
import { buildAssignmentAlarmEmail, formatMissingAssignmentLabel } from "@/lib/ops/assignment-alarm-copy";
import { assertDevAssignmentAlarmRuntime } from "@/lib/ops/assignment-alarm-dev-guard";
import { assertProdAssignmentAlarmRuntime } from "@/lib/ops/assignment-alarm-prod-guard";
import { evaluateAssignmentAlarm } from "@/lib/ops/assignment-alarm-decision";
import {
  ASSIGNMENT_ALARM_MAX_ATTEMPTS,
  assignmentAlarmPersistedProviderReference,
  isSuccessfulVoiceSubmission,
  nextAssignmentAlarmRetryAt,
  selectAssignmentAlarmChannelActions,
  shouldRetryVoiceOutcome,
} from "@/lib/ops/assignment-alarm-retry";
import {
  lateCreatedRemainingMinutes,
  reminderSlotKey,
  selectDueAssignmentAlarmSlot,
} from "@/lib/ops/assignment-alarm-slots";
import {
  isOperationAssignmentComplete,
  missingAssignmentParts,
  type OperationAssignmentState,
} from "@/lib/ops/assignment-completeness";

const PICKUP = new Date("2026-09-14T15:00:00.000Z");
const CREATED_FAR = new Date("2026-09-13T08:00:00.000Z");

function minutesBeforePickup(minutes: number) {
  return new Date(PICKUP.getTime() - minutes * 60_000);
}

function emptyAssignment(): OperationAssignmentState {
  return {
    acceptedPartnerId: null,
    assignedDriverKind: null,
    assignedDriverId: null,
    assignedDriverSnapshot: null,
    assignedVehicleKind: null,
    assignedVehicleId: null,
    assignedVehicleSnapshot: null,
  };
}

function registeredComplete(): OperationAssignmentState {
  return {
    acceptedPartnerId: "11111111-1111-1111-1111-111111111111",
    assignedDriverKind: "registered",
    assignedDriverId: "22222222-2222-2222-2222-222222222222",
    assignedDriverSnapshot: { firstName: "Ali", lastName: "Yılmaz" },
    assignedVehicleKind: "registered",
    assignedVehicleId: "33333333-3333-3333-3333-333333333333",
    assignedVehicleSnapshot: { plate: "34ABC123" },
  };
}

function nonTrpComplete(): OperationAssignmentState {
  return {
    acceptedPartnerId: "11111111-1111-1111-1111-111111111111",
    assignedDriverKind: "non_trp",
    assignedDriverId: null,
    assignedDriverSnapshot: {
      firstName: "Ahmet",
      lastName: "Kaya",
      phone: "+905551112233",
      phoneCountryCode: "TR",
    },
    assignedVehicleKind: "non_trp",
    assignedVehicleId: null,
    assignedVehicleSnapshot: {
      plate: "34ABC123",
      brandModel: "Mercedes Vito",
    },
  };
}

function decide(input: {
  remainingMinutes: number;
  createdAt?: Date;
  status?: string | null;
  deletedAt?: Date | null;
  driverTaskStage?: string | null;
  assignment?: OperationAssignmentState;
  deliveredKeys?: readonly string[];
  pickupAt?: Date | null;
}) {
  const now = minutesBeforePickup(input.remainingMinutes);
  return evaluateAssignmentAlarm({
    now,
    createdAt: input.createdAt ?? CREATED_FAR,
    status: input.status ?? "confirmed",
    deletedAt: input.deletedAt ?? null,
    pickupAt: input.pickupAt === undefined ? PICKUP : input.pickupAt,
    driverTaskStage: input.driverTaskStage ?? null,
    assignment: input.assignment ?? emptyAssignment(),
    deliveredKeys: input.deliveredKeys ?? [],
  });
}

test("1. three hours out with missing assignment produces no alarm", () => {
  const decision = decide({ remainingMinutes: 180 });
  assert.deepEqual(decision, { action: "skip", reason: "outside_window" });
});

test("2. exactly two-hour window with missing assignment sends first reminder", () => {
  const decision = decide({ remainingMinutes: 120 });
  assert.equal(decision.action, "deliver");
  if (decision.action !== "deliver") {
    return;
  }
  assert.equal(decision.slot.kind, "planned");
  assert.equal(decision.slot.urgency, "normal");
  assert.equal(decision.slot.key, reminderSlotKey(PICKUP, "tminus-120"));
});

test("3. 90 minutes remaining uses the 30-minute normal cadence", () => {
  const first = decide({ remainingMinutes: 120 });
  const second = decide({
    remainingMinutes: 90,
    deliveredKeys:
      first.action === "deliver" ? [first.slot.key] : [],
  });
  assert.equal(second.action, "deliver");
  if (second.action !== "deliver") {
    return;
  }
  assert.equal(second.slot.key, reminderSlotKey(PICKUP, "tminus-90"));
  assert.equal(second.slot.urgency, "normal");
  const noBurst = decide({
    remainingMinutes: 90,
    deliveredKeys: [second.slot.key],
  });
  assert.deepEqual(noBurst, { action: "skip", reason: "no_slot" });
});

test("4. 59 minutes remaining uses urgent cadence", () => {
  const decision = decide({ remainingMinutes: 59 });
  assert.equal(decision.action, "deliver");
  if (decision.action !== "deliver") {
    return;
  }
  assert.equal(decision.slot.key, reminderSlotKey(PICKUP, "tminus-60"));
  assert.equal(decision.slot.urgency, "urgent");
});

test("5. 30 minutes remaining stays on 10-minute urgent slots", () => {
  const decision = decide({ remainingMinutes: 30 });
  assert.equal(decision.action, "deliver");
  if (decision.action !== "deliver") {
    return;
  }
  assert.equal(decision.slot.key, reminderSlotKey(PICKUP, "tminus-30"));
  assert.equal(decision.slot.urgency, "urgent");
});

test("6. reservation created 50 minutes before pickup alarms on the first cycle", () => {
  const createdAt = minutesBeforePickup(50);
  const decision = decide({ remainingMinutes: 50, createdAt });
  assert.equal(decision.action, "deliver");
  if (decision.action !== "deliver") {
    return;
  }
  assert.ok(decision.slot.kind === "planned" || decision.slot.kind === "catchup");
  assert.equal(decision.slot.urgency, "urgent");
});

test("7. T-110 catch-up is immediate and then waits about 30 minutes", () => {
  const createdAt = minutesBeforePickup(110);
  assert.deepEqual(lateCreatedRemainingMinutes(PICKUP, createdAt), [
    110, 80, 50, 40, 30, 20, 10,
  ]);
  const first = decide({ remainingMinutes: 110, createdAt });
  assert.equal(first.action, "deliver");
  if (first.action !== "deliver") {
    return;
  }
  assert.equal(first.slot.kind, "catchup");
  assert.equal(first.slot.key, reminderSlotKey(PICKUP, "catchup"));
  const tooSoon = decide({
    remainingMinutes: 90,
    createdAt,
    deliveredKeys: [first.slot.key],
  });
  assert.deepEqual(tooSoon, { action: "skip", reason: "no_slot" });
  const next = decide({
    remainingMinutes: 80,
    createdAt,
    deliveredKeys: [first.slot.key],
  });
  assert.equal(next.action, "deliver");
  if (next.action !== "deliver") {
    return;
  }
  assert.equal(next.slot.kind, "followup");
  assert.equal(next.slot.key, reminderSlotKey(PICKUP, "late-tminus-80"));
});

test("8. registered driver + vehicle stops reminders", () => {
  assert.equal(isOperationAssignmentComplete(registeredComplete()), true);
  const decision = decide({
    remainingMinutes: 90,
    assignment: registeredComplete(),
  });
  assert.deepEqual(decision, { action: "skip", reason: "complete" });
});

test("9. NON-TRP driver + vehicle stops reminders", () => {
  assert.equal(isOperationAssignmentComplete(nonTrpComplete()), true);
  const decision = decide({
    remainingMinutes: 40,
    assignment: nonTrpComplete(),
  });
  assert.deepEqual(decision, { action: "skip", reason: "complete" });
});

test("10. partner present but driver missing keeps the alarm", () => {
  const assignment: OperationAssignmentState = {
    ...registeredComplete(),
    assignedDriverKind: null,
    assignedDriverId: null,
    assignedDriverSnapshot: null,
  };
  assert.deepEqual(missingAssignmentParts(assignment), ["driver"]);
  const decision = decide({ remainingMinutes: 90, assignment });
  assert.equal(decision.action, "deliver");
});

test("11. driver present but vehicle missing keeps the alarm", () => {
  const assignment: OperationAssignmentState = {
    ...registeredComplete(),
    assignedVehicleKind: null,
    assignedVehicleId: null,
    assignedVehicleSnapshot: null,
  };
  assert.deepEqual(missingAssignmentParts(assignment), ["vehicle"]);
  const decision = decide({ remainingMinutes: 90, assignment });
  assert.equal(decision.action, "deliver");
});

test("12. completing assignment after reminders started stops the next slot", () => {
  const started = decide({ remainingMinutes: 120 });
  assert.equal(started.action, "deliver");
  const next = decide({
    remainingMinutes: 90,
    deliveredKeys: started.action === "deliver" ? [started.slot.key] : [],
    assignment: registeredComplete(),
  });
  assert.deepEqual(next, { action: "skip", reason: "complete" });
});

test("13. pickup time change recalculates cadence from the new instant", () => {
  const oldPickup = PICKUP;
  const newPickup = new Date(PICKUP.getTime() + 3 * 60 * 60 * 1000);
  const oldKey = reminderSlotKey(oldPickup, "tminus-120");
  const now = new Date(newPickup.getTime() - 120 * 60 * 1000);
  const decision = evaluateAssignmentAlarm({
    now,
    createdAt: CREATED_FAR,
    status: "confirmed",
    deletedAt: null,
    pickupAt: newPickup,
    driverTaskStage: null,
    assignment: emptyAssignment(),
    deliveredKeys: [oldKey],
  });
  assert.equal(decision.action, "deliver");
  if (decision.action !== "deliver") {
    return;
  }
  assert.equal(decision.slot.key, reminderSlotKey(newPickup, "tminus-120"));
  assert.notEqual(decision.slot.key, oldKey);
});

test("14. cancelled reservation never alarms", () => {
  const decision = decide({ remainingMinutes: 90, status: "cancelled" });
  assert.deepEqual(decision, { action: "skip", reason: "terminal" });
});

test("15. completed driver-task reservation never alarms", () => {
  const decision = decide({
    remainingMinutes: 90,
    driverTaskStage: "completed",
  });
  assert.deepEqual(decision, { action: "skip", reason: "terminal" });
});

test("16. no-show and other non-confirmed statuses never alarm", () => {
  assert.deepEqual(decide({ remainingMinutes: 90, status: "no_show" }), {
    action: "skip",
    reason: "terminal",
  });
  assert.deepEqual(decide({ remainingMinutes: 90, status: "payment_pending" }), {
    action: "skip",
    reason: "terminal",
  });
  assert.deepEqual(
    decide({
      remainingMinutes: 90,
      deletedAt: new Date("2026-09-14T10:00:00.000Z"),
    }),
    { action: "skip", reason: "terminal" },
  );
});

test("17. pickup time in the past does not keep urgent reminders", () => {
  const decision = evaluateAssignmentAlarm({
    now: new Date(PICKUP.getTime() + 5 * 60 * 1000),
    createdAt: CREATED_FAR,
    status: "confirmed",
    deletedAt: null,
    pickupAt: PICKUP,
    driverTaskStage: null,
    assignment: emptyAssignment(),
    deliveredKeys: [],
  });
  assert.deepEqual(decision, { action: "skip", reason: "terminal" });
  assert.equal(
    selectDueAssignmentAlarmSlot({
      now: new Date(PICKUP.getTime() + 1),
      pickupAt: PICKUP,
      createdAt: CREATED_FAR,
      deliveredKeys: [],
    }),
    null,
  );
});

test("18. email provider failure still attempts the voice channel", async () => {
  const results = await runIndependentAssignmentAlarmChannels(
    ASSIGNMENT_ALARM_CHANNELS,
    async (channel) => {
      if (channel === "email") {
        throw new Error("smtp_down");
      }
      return { status: "sent", error: null };
    },
  );
  assert.deepEqual(results.email, { status: "failed", error: "smtp_down" });
  assert.deepEqual(results.voice, { status: "sent", error: null });
});

test("19. voice provider failure still attempts the email channel", async () => {
  const results = await runIndependentAssignmentAlarmChannels(
    ASSIGNMENT_ALARM_CHANNELS,
    async (channel) => {
      if (channel === "voice") {
        return { status: "failed", error: "twilio_400" };
      }
      return { status: "sent", error: null };
    },
  );
  assert.deepEqual(results.email, { status: "sent", error: null });
  assert.deepEqual(results.voice, { status: "failed", error: "twilio_400" });
});

test("a slot stays due until both channels have attempted it", () => {
  const slot = reminderSlotKey(PICKUP, "tminus-90");
  assert.deepEqual(
    fullyDeliveredAssignmentAlarmSlots([{ reminder_slot: slot, channel: "email" }]),
    [],
  );
  assert.deepEqual(
    fullyDeliveredAssignmentAlarmSlots([
      { reminder_slot: slot, channel: "email" },
      { reminder_slot: slot, channel: "voice" },
    ]),
    [slot],
  );
});

test("20. the same slot is not delivered twice", async () => {
  const claims = createMemoryAssignmentAlarmClaims();
  const slot = reminderSlotKey(PICKUP, "tminus-90");
  const first = claims.tryClaim("res-1", slot, "email");
  const second = claims.tryClaim("res-1", slot, "email");
  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(claims.tryClaim("res-1", slot, "voice"), true);
});

test("21. persisted slot keys survive a worker restart", () => {
  const persisted = [reminderSlotKey(PICKUP, "tminus-120")];
  const afterRestart = decide({
    remainingMinutes: 115,
    deliveredKeys: persisted,
  });
  assert.deepEqual(afterRestart, { action: "skip", reason: "no_slot" });
  const nextCadence = decide({
    remainingMinutes: 90,
    deliveredKeys: persisted,
  });
  assert.equal(nextCadence.action, "deliver");
  if (nextCadence.action !== "deliver") {
    return;
  }
  assert.equal(nextCadence.slot.key, reminderSlotKey(PICKUP, "tminus-90"));
});

test("22. concurrent workers cannot claim the same slot and channel", async () => {
  const claims = createMemoryAssignmentAlarmClaims();
  const slot = reminderSlotKey(PICKUP, "tminus-60");
  const attempts = await Promise.all(
    Array.from({ length: 8 }, async () => claims.tryClaim("res-2", slot, "voice")),
  );
  assert.equal(attempts.filter(Boolean).length, 1);
});

test("23. registered and NON-TRP shapes follow the live assignment schema", () => {
  assert.deepEqual(missingAssignmentParts(emptyAssignment()), [
    "partner",
    "driver",
    "vehicle",
  ]);
  assert.equal(isOperationAssignmentComplete(registeredComplete()), true);
  assert.equal(isOperationAssignmentComplete(nonTrpComplete()), true);
  assert.equal(
    isOperationAssignmentComplete({
      ...nonTrpComplete(),
      assignedDriverSnapshot: {},
    }),
    false,
  );
  assert.equal(
    formatMissingAssignmentLabel(["partner", "driver", "vehicle"]),
    "Eksik: Partner + Şoför + Araç",
  );
  assert.equal(formatMissingAssignmentLabel(["driver", "vehicle"]), "Eksik: Şoför + Araç");
});

test("T-37 late-created series stays on 10-minute follow-ups until cutoff", () => {
  const createdAt = minutesBeforePickup(37);
  assert.deepEqual(lateCreatedRemainingMinutes(PICKUP, createdAt), [
    37, 27, 17, 7,
  ]);
});

test("8b. T-55 catch-up is immediate and then waits about 10 minutes", () => {
  const createdAt = minutesBeforePickup(55);
  assert.deepEqual(lateCreatedRemainingMinutes(PICKUP, createdAt), [
    55, 45, 35, 25, 15, 5,
  ]);
  const first = decide({ remainingMinutes: 55, createdAt });
  assert.equal(first.action, "deliver");
  if (first.action !== "deliver") {
    return;
  }
  assert.equal(first.slot.kind, "catchup");
  const tooSoon = decide({
    remainingMinutes: 50,
    createdAt,
    deliveredKeys: [first.slot.key],
  });
  assert.deepEqual(tooSoon, { action: "skip", reason: "no_slot" });
  const next = decide({
    remainingMinutes: 45,
    createdAt,
    deliveredKeys: [first.slot.key],
  });
  assert.equal(next.action, "deliver");
  if (next.action !== "deliver") {
    return;
  }
  assert.equal(next.slot.key, reminderSlotKey(PICKUP, "late-tminus-45"));
  assert.equal(next.slot.urgency, "urgent");
});

test("email copy stays operational and includes the reservation code", () => {
  const email = buildAssignmentAlarmEmail({
    reservationCode: "TRP-ABC12345",
    remainingMs: 38 * 60_000,
    urgency: "urgent",
    pickupAtLabel: "14.09.2026 18:00",
    serviceTypeLabel: "Transfer",
    pickup: "IST",
    dropoff: "Sultanahmet",
    vehicleClass: "VIP",
    customerName: "Ada Yılmaz",
    missing: ["driver", "vehicle"],
    opsHref: "https://dev.tripetica.com/tr/ops/reservations/abc",
  });
  assert.match(email.subject, /ACİL: Operasyon Ataması Eksik — TRP-ABC12345 — 38 dk kaldı/);
  assert.match(email.text, /TRP-ABC12345/);
  assert.match(email.text, /Eksik: Şoför \+ Araç/);
  assert.match(email.text, /Ops: https:\/\/dev\.tripetica\.com\/tr\/ops\/reservations\/abc/);
});

test("DEV keeps mail and voice dry-run unless explicitly enabled", () => {
  assert.equal(
    isProductionAssignmentAlarmEnvironment("development", "tripetica_dev"),
    false,
  );
  assert.equal(
    assignmentAlarmEmailRecipient({
      NODE_ENV: "development",
      EXPECTED_DATABASE: "tripetica_dev",
    }),
    null,
  );
  assert.equal(
    assignmentAlarmEmailRecipient({
      NODE_ENV: "development",
      EXPECTED_DATABASE: "tripetica_dev",
      ASSIGNMENT_ALARM_EMAIL_TO: "ops-test@example.com",
    }),
    "ops-test@example.com",
  );
  assert.equal(
    assignmentAlarmEmailRecipient({
      NODE_ENV: "production",
      EXPECTED_DATABASE: "tripetica",
    }),
    PRODUCTION_ASSIGNMENT_ALARM_EMAIL_TO,
  );
  assert.equal(assignmentAlarmVoiceEnabled({}), false);
  assert.equal(
    assignmentAlarmVoiceEnabled({ ASSIGNMENT_ALARM_VOICE_ENABLED: "true" }),
    true,
  );
});

test("worker claims one slot per channel and does not hardcode a phone number", () => {
  const worker = readFileSync(new URL("./assignment-alarm.ts", import.meta.url), "utf8");
  const config = readFileSync(
    new URL("./assignment-alarm-config.ts", import.meta.url),
    "utf8",
  );
  const script = readFileSync(
    new URL("../../scripts/dispatch-assignment-alarms.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL("../../db/migrations/048_assignment_alarm.sql", import.meta.url),
    "utf8",
  );
  const retryMigration = readFileSync(
    new URL("../../db/migrations/049_assignment_alarm_retry.sql", import.meta.url),
    "utf8",
  );
  assert.match(worker, /evaluateAssignmentAlarm/);
  assert.match(worker, /runIndependentAssignmentAlarmChannels/);
  assert.match(worker, /reservationMailFromAddress/);
  assert.match(worker, /assignmentAlarmVoiceEnabled/);
  assert.match(worker, /startTwilioVoiceCall\(config\)/);
  assert.match(worker, /isSuccessfulVoiceSubmission/);
  assert.match(worker, /assignmentAlarmPersistedProviderReference\(delivered\)/);
  assert.match(worker, /ON CONFLICT \(reservation_id, reminder_slot, channel\) DO NOTHING/);
  assert.doesNotMatch(worker, /<Say/);
  assert.doesNotMatch(worker, /assignmentAlarmVoiceTwiml/);
  assert.doesNotMatch(worker, /buildAssignmentAlarmVoiceSay/);
  assert.match(config, /ASSIGNMENT_ALARM_VOICE_ENABLED/);
  assert.match(script, /assertDevAssignmentAlarmRuntime/);
  assert.doesNotMatch(worker, /\+\d{8,}/);
  assert.doesNotMatch(worker, /noreply@tripetica\.com/);
  assert.match(migration, /UNIQUE \(reservation_id, reminder_slot, channel\)/);
  assert.match(retryMigration, /next_retry_at/);
  assert.match(retryMigration, /assignment_alarm_dev_probes/);
});

test("production runtime guard accepts only tripetica production", () => {
  assert.throws(
    () =>
      assertProdAssignmentAlarmRuntime({
        NODE_ENV: "development",
        EXPECTED_DATABASE: "tripetica",
        DATABASE_URL: "postgresql://localhost/tripetica",
      }),
    /NODE_ENV=production/,
  );
  assert.throws(
    () =>
      assertProdAssignmentAlarmRuntime({
        NODE_ENV: "production",
        EXPECTED_DATABASE: "tripetica_dev",
        DATABASE_URL: "postgresql://localhost/tripetica_dev",
      }),
    /EXPECTED_DATABASE=tripetica/,
  );
  assert.doesNotThrow(() =>
    assertProdAssignmentAlarmRuntime({
      NODE_ENV: "production",
      EXPECTED_DATABASE: "tripetica",
      DATABASE_URL: "postgresql://localhost/tripetica",
    }),
  );
  const prodScript = readFileSync(
    new URL("../../scripts/dispatch-assignment-alarms-prod.ts", import.meta.url),
    "utf8",
  );
  const prodUnit = readFileSync(
    new URL("../../deploy/systemd/tripetica-assignment-alarm.service", import.meta.url),
    "utf8",
  );
  assert.match(prodScript, /assertProdAssignmentAlarmRuntime/);
  assert.doesNotMatch(prodScript, /assertDevAssignmentAlarmRuntime/);
  assert.doesNotMatch(prodScript, /tripetica_dev/);
  assert.match(prodUnit, /EXPECTED_DATABASE=tripetica/);
  assert.match(prodUnit, /WorkingDirectory=\/srv\/tripetica\/current/);
  assert.match(prodUnit, /assert-expected-database/);
  assert.match(prodUnit, /assignment-alarm:dispatch:prod/);
  assert.doesNotMatch(prodUnit, /tripetica-dev-assignment-alarm/);
});

test("DEV runtime guard rejects production and non-dev databases", () => {
  assert.throws(
    () =>
      assertDevAssignmentAlarmRuntime({
        NODE_ENV: "production",
        EXPECTED_DATABASE: "tripetica_dev",
        DATABASE_URL: "postgresql://localhost/tripetica_dev",
      }),
    /DEV-only/,
  );
  assert.throws(
    () =>
      assertDevAssignmentAlarmRuntime({
        NODE_ENV: "development",
        EXPECTED_DATABASE: "tripetica",
        DATABASE_URL: "postgresql://localhost/tripetica",
      }),
    /tripetica_dev/,
  );
  assert.doesNotThrow(() =>
    assertDevAssignmentAlarmRuntime({
      NODE_ENV: "development",
      EXPECTED_DATABASE: "tripetica_dev",
      DATABASE_URL: "postgresql://localhost/tripetica_dev",
    }),
  );
});

test("voice Call SID is persisted as provider_reference and kept on a second pass", () => {
  const callSid = "CA1234567890abcdef1234567890abcd";
  assert.equal(isSuccessfulVoiceSubmission({ ok: true, callSid }), true);
  const first = {
    status: "sent" as const,
    providerReference: assignmentAlarmPersistedProviderReference({
      reference: callSid,
    }),
    error: null,
  };
  assert.equal(first.status, "sent");
  assert.equal(first.providerReference, callSid);

  const store = new Map<string, { status: string; providerReference: string | null }>();
  const claims = createMemoryAssignmentAlarmClaims();
  const slot = reminderSlotKey(PICKUP, "catchup");
  assert.equal(claims.tryClaim("res-e2e", slot, "voice"), true);
  store.set("voice", first);

  const secondPass = selectAssignmentAlarmChannelActions(
    ASSIGNMENT_ALARM_CHANNELS,
    [
      {
        channel: "voice",
        status: "sent",
        attemptCount: 1,
        nextRetryAt: null,
      },
    ],
    new Date(),
  );
  assert.equal(claims.tryClaim("res-e2e", slot, "voice"), false);
  assert.equal(secondPass.find((item) => item.channel === "voice")?.action, "skip");
  assert.equal(store.get("voice")?.providerReference, callSid);
  assert.equal(
    assignmentAlarmPersistedProviderReference({ providerReference: null }),
    null,
  );
  assert.equal(
    assignmentAlarmPersistedProviderReference({ reference: null }),
    null,
  );
});

test("1b. Twilio Call SID means the voice slot is submitted", () => {
  assert.equal(
    isSuccessfulVoiceSubmission({
      ok: true,
      callSid: "CAcccccccccccccccccccccccccccccccc",
    }),
    true,
  );
  assert.equal(isSuccessfulVoiceSubmission({ ok: true, callSid: "XX" }), false);
  assert.equal(shouldRetryVoiceOutcome({
    submitted: true,
    callSid: "CAcccccccccccccccccccccccccccccccc",
  }), false);
});

test("2b. busy/rejected/no-answer after a Call SID does not retry the same slot", () => {
  for (const laterStatus of ["busy", "no-answer", "rejected", "canceled"]) {
    assert.equal(
      shouldRetryVoiceOutcome({
        submitted: true,
        callSid: "CAcccccccccccccccccccccccccccccccc",
        laterStatus,
      }),
      false,
    );
  }
  const actions = selectAssignmentAlarmChannelActions(
    ASSIGNMENT_ALARM_CHANNELS,
    [
      {
        channel: "voice",
        status: "sent",
        attemptCount: 1,
        nextRetryAt: null,
      },
    ],
    new Date(),
  );
  assert.equal(actions.find((item) => item.channel === "voice")?.action, "skip");
});

test("3b. Twilio request creation error uses controlled backoff retry", () => {
  assert.equal(
    shouldRetryVoiceOutcome({ submitted: false, laterStatus: null }),
    true,
  );
  const now = new Date("2026-09-14T12:00:00.000Z");
  const firstRetry = nextAssignmentAlarmRetryAt(1, now);
  assert.equal(firstRetry?.getTime(), now.getTime() + 4 * 60 * 1000);
  const secondRetry = nextAssignmentAlarmRetryAt(2, now);
  assert.equal(secondRetry?.getTime(), now.getTime() + 8 * 60 * 1000);
  assert.equal(nextAssignmentAlarmRetryAt(ASSIGNMENT_ALARM_MAX_ATTEMPTS, now), null);
  const immediate = selectAssignmentAlarmChannelActions(
    ["voice"],
    [
      {
        channel: "voice",
        status: "failed",
        attemptCount: 1,
        nextRetryAt: firstRetry,
      },
    ],
    now,
  );
  assert.equal(immediate[0]?.action, "skip");
  const due = selectAssignmentAlarmChannelActions(
    ["voice"],
    [
      {
        channel: "voice",
        status: "failed",
        attemptCount: 1,
        nextRetryAt: firstRetry,
      },
    ],
    firstRetry ?? now,
  );
  assert.equal(due[0]?.action, "attempt");
});

test("4b. email sent + voice technical failure retries only voice", () => {
  const now = new Date("2026-09-14T12:10:00.000Z");
  const actions = selectAssignmentAlarmChannelActions(
    ASSIGNMENT_ALARM_CHANNELS,
    [
      { channel: "email", status: "sent", attemptCount: 1, nextRetryAt: null },
      {
        channel: "voice",
        status: "failed",
        attemptCount: 1,
        nextRetryAt: now,
      },
    ],
    now,
  );
  assert.deepEqual(actions, [
    { channel: "email", action: "skip" },
    { channel: "voice", action: "attempt" },
  ]);
});

test("5b. voice submitted + email failed retries only email", () => {
  const now = new Date("2026-09-14T12:10:00.000Z");
  const actions = selectAssignmentAlarmChannelActions(
    ASSIGNMENT_ALARM_CHANNELS,
    [
      {
        channel: "email",
        status: "failed",
        attemptCount: 1,
        nextRetryAt: now,
      },
      { channel: "voice", status: "sent", attemptCount: 1, nextRetryAt: null },
    ],
    now,
  );
  assert.deepEqual(actions, [
    { channel: "email", action: "attempt" },
    { channel: "voice", action: "skip" },
  ]);
});

test("fired slot keys count a slot after the first channel row exists", () => {
  const slot = reminderSlotKey(PICKUP, "tminus-60");
  assert.deepEqual(
    firedAssignmentAlarmSlots([{ reminder_slot: slot }]),
    [slot],
  );
  assert.deepEqual(
    fullyDeliveredAssignmentAlarmSlots([{ reminder_slot: slot, channel: "email" }]),
    [],
  );
});
