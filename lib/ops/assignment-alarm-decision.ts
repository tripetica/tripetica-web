import {
  isInsideAssignmentAlarmWindow,
  selectDueAssignmentAlarmSlot,
  type DueAssignmentAlarmSlot,
} from "@/lib/ops/assignment-alarm-slots";
import { shouldSkipAssignmentAlarm } from "@/lib/ops/assignment-alarm-policy";
import {
  isOperationAssignmentComplete,
  type OperationAssignmentState,
} from "@/lib/ops/assignment-completeness";

export type AssignmentAlarmDecision =
  | {
      action: "skip";
      reason: "terminal" | "complete" | "outside_window" | "no_slot";
    }
  | { action: "deliver"; slot: DueAssignmentAlarmSlot };

export function evaluateAssignmentAlarm(input: {
  now: Date;
  createdAt: Date;
  status: string | null;
  deletedAt: Date | null;
  pickupAt: Date | null;
  driverTaskStage: string | null;
  assignment: OperationAssignmentState;
  deliveredKeys: readonly string[];
}): AssignmentAlarmDecision {
  if (
    shouldSkipAssignmentAlarm(
      {
        status: input.status,
        deletedAt: input.deletedAt,
        pickupAt: input.pickupAt,
        driverTaskStage: input.driverTaskStage,
      },
      input.now,
    )
  ) {
    return { action: "skip", reason: "terminal" };
  }
  if (isOperationAssignmentComplete(input.assignment)) {
    return { action: "skip", reason: "complete" };
  }
  if (!input.pickupAt || !isInsideAssignmentAlarmWindow(input.now, input.pickupAt)) {
    return { action: "skip", reason: "outside_window" };
  }
  const slot = selectDueAssignmentAlarmSlot({
    now: input.now,
    pickupAt: input.pickupAt,
    createdAt: input.createdAt,
    deliveredKeys: input.deliveredKeys,
  });
  if (!slot) {
    return { action: "skip", reason: "no_slot" };
  }
  return { action: "deliver", slot };
}
