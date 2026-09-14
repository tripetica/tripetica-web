import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import {
  decideEmergencyVoiceAlert,
  isOvernightMorningVoiceAlert,
  isUrgentVoiceAlert,
  shouldPlaceVoiceAlert,
} from "@/lib/alerts/voice-alert-policy";
import { evaluateAssignmentAlarm } from "@/lib/ops/assignment-alarm-decision";
import {
  isOperationAssignmentComplete,
  missingAssignmentParts,
  type OperationAssignmentState,
} from "@/lib/ops/assignment-completeness";
import { reminderSlotKey } from "@/lib/ops/assignment-alarm-slots";

function istanbul(local: string) {
  return new Date(istanbulLocalToUtcMs(local));
}

const confirmed = {
  status: "confirmed",
  paymentMethod: "cash" as const,
  paymentStatus: null as string | null,
  deletedAt: null,
  alreadyStarted: false,
  enabled: true,
};

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

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("1. new reservation pickup < 2h does not place a creation-time phone call", () => {
  const created = istanbul("2026-09-06T14:00");
  const pickup = istanbul("2026-09-06T15:30");
  assert.equal(isUrgentVoiceAlert(pickup, created), true);
  assert.equal(shouldPlaceVoiceAlert(pickup, created), false);
  assert.deepEqual(
    decideEmergencyVoiceAlert({
      ...confirmed,
      decidedAt: created,
      pickupAt: pickup,
    }),
    { action: "skip", reason: "creation_call_retired" },
  );
});

test("2. pickup < 2h with incomplete assignment still schedules assignment alarms", () => {
  const createdAt = minutesBeforePickup(90);
  const now = minutesBeforePickup(90);
  assert.deepEqual(
    decideEmergencyVoiceAlert({
      ...confirmed,
      decidedAt: createdAt,
      pickupAt: PICKUP,
    }),
    { action: "skip", reason: "creation_call_retired" },
  );
  const decision = evaluateAssignmentAlarm({
    now,
    createdAt,
    status: "confirmed",
    deletedAt: null,
    pickupAt: PICKUP,
    driverTaskStage: null,
    assignment: emptyAssignment(),
    deliveredKeys: [],
  });
  assert.equal(decision.action, "deliver");
});

test("3. retired night-booking create window no longer places a creation call", () => {
  const created = istanbul("2026-09-06T03:00");
  const pickup = istanbul("2026-09-06T09:45");
  assert.equal(isOvernightMorningVoiceAlert(pickup, created), true);
  assert.equal(shouldPlaceVoiceAlert(pickup, created), false);
  assert.deepEqual(
    decideEmergencyVoiceAlert({
      ...confirmed,
      decidedAt: created,
      pickupAt: pickup,
    }),
    { action: "skip", reason: "creation_call_retired" },
  );
});

test("4. retired early-morning pickup night rule no longer places a creation call", () => {
  const created = istanbul("2026-09-06T00:15");
  const pickup = istanbul("2026-09-06T08:30");
  assert.equal(isOvernightMorningVoiceAlert(pickup, created), true);
  assert.equal(shouldPlaceVoiceAlert(pickup, created), false);
  assert.deepEqual(
    decideEmergencyVoiceAlert({
      ...confirmed,
      decidedAt: created,
      pickupAt: pickup,
    }),
    { action: "skip", reason: "creation_call_retired" },
  );
});

test("5. incomplete assignment at T-120 still delivers the assignment phone alarm slot", () => {
  const decision = evaluateAssignmentAlarm({
    now: minutesBeforePickup(120),
    createdAt: CREATED_FAR,
    status: "confirmed",
    deletedAt: null,
    pickupAt: PICKUP,
    driverTaskStage: null,
    assignment: emptyAssignment(),
    deliveredKeys: [],
  });
  assert.equal(decision.action, "deliver");
  if (decision.action !== "deliver") {
    return;
  }
  assert.equal(decision.slot.key, reminderSlotKey(PICKUP, "tminus-120"));
  assert.equal(decision.slot.urgency, "normal");
});

test("6. incomplete assignment at T-90 still delivers the assignment phone alarm slot", () => {
  const first = evaluateAssignmentAlarm({
    now: minutesBeforePickup(120),
    createdAt: CREATED_FAR,
    status: "confirmed",
    deletedAt: null,
    pickupAt: PICKUP,
    driverTaskStage: null,
    assignment: emptyAssignment(),
    deliveredKeys: [],
  });
  const decision = evaluateAssignmentAlarm({
    now: minutesBeforePickup(90),
    createdAt: CREATED_FAR,
    status: "confirmed",
    deletedAt: null,
    pickupAt: PICKUP,
    driverTaskStage: null,
    assignment: emptyAssignment(),
    deliveredKeys: first.action === "deliver" ? [first.slot.key] : [],
  });
  assert.equal(decision.action, "deliver");
  if (decision.action !== "deliver") {
    return;
  }
  assert.equal(decision.slot.key, reminderSlotKey(PICKUP, "tminus-90"));
});

test("7. incomplete assignment under 1h keeps T-50 through T-10 slots", () => {
  for (const minutes of [50, 40, 30, 20, 10] as const) {
    const decision = evaluateAssignmentAlarm({
      now: minutesBeforePickup(minutes),
      createdAt: CREATED_FAR,
      status: "confirmed",
      deletedAt: null,
      pickupAt: PICKUP,
      driverTaskStage: null,
      assignment: emptyAssignment(),
      deliveredKeys: [],
    });
    assert.equal(decision.action, "deliver", `T-${minutes}`);
    if (decision.action !== "deliver") {
      continue;
    }
    assert.equal(decision.slot.key, reminderSlotKey(PICKUP, `tminus-${minutes}`));
    assert.equal(decision.slot.urgency, "urgent");
  }
});

test("8. complete assignment still stops reminders", () => {
  assert.equal(isOperationAssignmentComplete(registeredComplete()), true);
  const decision = evaluateAssignmentAlarm({
    now: minutesBeforePickup(90),
    createdAt: CREATED_FAR,
    status: "confirmed",
    deletedAt: null,
    pickupAt: PICKUP,
    driverTaskStage: null,
    assignment: registeredComplete(),
    deliveredKeys: [],
  });
  assert.deepEqual(decision, { action: "skip", reason: "complete" });
});

test("9. partner/driver/vehicle completeness still gates assignment alarms", () => {
  assert.deepEqual(missingAssignmentParts(emptyAssignment()), [
    "partner",
    "driver",
    "vehicle",
  ]);
  const partnerOnly: OperationAssignmentState = {
    ...emptyAssignment(),
    acceptedPartnerId: "11111111-1111-1111-1111-111111111111",
  };
  assert.deepEqual(missingAssignmentParts(partnerOnly), ["driver", "vehicle"]);
  const missingDriver: OperationAssignmentState = {
    ...registeredComplete(),
    assignedDriverKind: null,
    assignedDriverId: null,
    assignedDriverSnapshot: null,
  };
  assert.deepEqual(missingAssignmentParts(missingDriver), ["driver"]);
  const missingVehicle: OperationAssignmentState = {
    ...registeredComplete(),
    assignedVehicleKind: null,
    assignedVehicleId: null,
    assignedVehicleSnapshot: null,
  };
  assert.deepEqual(missingAssignmentParts(missingVehicle), ["vehicle"]);
  assert.equal(
    evaluateAssignmentAlarm({
      now: minutesBeforePickup(90),
      createdAt: CREATED_FAR,
      status: "confirmed",
      deletedAt: null,
      pickupAt: PICKUP,
      driverTaskStage: null,
      assignment: missingDriver,
      deliveredKeys: [],
    }).action,
    "deliver",
  );
});

test("10. reservation confirmation and ops mail hooks stay; creation call hook is gone", () => {
  const complete = source("app/api/booking/complete/route.ts");
  const callback = source("app/api/payments/turinvoice/callback/route.ts");
  const assignmentAlarm = source("lib/ops/assignment-alarm.ts");
  assert.match(complete, /sendReservationConfirmationEmail/);
  assert.match(complete, /sendOperationReservationNotification/);
  assert.match(callback, /sendReservationConfirmationEmail/);
  assert.doesNotMatch(complete, /maybeStartEmergencyReservationVoiceAlert/);
  assert.doesNotMatch(callback, /maybeStartEmergencyReservationVoiceAlert/);
  assert.match(assignmentAlarm, /startTwilioVoiceCall/);
  assert.match(assignmentAlarm, /evaluateAssignmentAlarm/);
});
