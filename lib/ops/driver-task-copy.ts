import { timestamptzToIstanbulLocal } from "@/lib/booking/istanbul-time";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  type DriverTaskProgressStage,
  type DriverTaskStage,
} from "@/lib/ops/driver-task-stages";

export function formatDriverTaskClock(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const local = timestamptzToIstanbulLocal(value);
  return local.slice(11, 16);
}

export function driverTaskStageLabel(stage: DriverTaskStage, copy: OpsCopy) {
  switch (stage) {
    case "en_route":
      return copy.driverTaskEnRoute;
    case "arrived":
      return copy.driverTaskArrived;
    case "picked_up":
      return copy.driverTaskPickedUp;
    case "completed":
      return copy.driverTaskCompleted;
    default:
      return copy.driverTaskPlanned;
  }
}

export function driverTaskHistoryLabel(stage: DriverTaskProgressStage, copy: OpsCopy) {
  switch (stage) {
    case "en_route":
      return copy.driverTaskHistoryEnRoute;
    case "arrived":
      return copy.driverTaskHistoryArrived;
    case "picked_up":
      return copy.driverTaskHistoryPickedUp;
    case "completed":
      return copy.driverTaskHistoryCompleted;
  }
}

export function driverTaskStatusLine(
  stage: DriverTaskStage,
  events: Array<{ stage: string; occurredAt: string }>,
  copy: OpsCopy,
) {
  const latest = [...events].reverse().find((event) => event.stage === stage);
  const clock = latest ? formatDriverTaskClock(latest.occurredAt) : "";
  const label = driverTaskStageLabel(stage, copy);
  return clock ? `${label} · ${clock}` : label;
}
