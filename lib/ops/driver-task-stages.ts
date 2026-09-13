export const DRIVER_TASK_STAGES = [
  "planned",
  "en_route",
  "arrived",
  "picked_up",
  "completed",
] as const;

export type DriverTaskStage = (typeof DRIVER_TASK_STAGES)[number];

export const DRIVER_TASK_EVENT_SOURCES = ["driver_link", "ops_manual"] as const;
export type DriverTaskEventSource = (typeof DRIVER_TASK_EVENT_SOURCES)[number];

export const DRIVER_TASK_PROGRESS = [
  "en_route",
  "arrived",
  "picked_up",
  "completed",
] as const;

export type DriverTaskProgressStage = (typeof DRIVER_TASK_PROGRESS)[number];

const NEXT_STAGE: Record<DriverTaskStage, DriverTaskStage | null> = {
  planned: "en_route",
  en_route: "arrived",
  arrived: "picked_up",
  picked_up: "completed",
  completed: null,
};

export function isDriverTaskStage(value: string | null | undefined): value is DriverTaskStage {
  return (DRIVER_TASK_STAGES as readonly string[]).includes(value ?? "");
}

export function nextDriverTaskStage(stage: DriverTaskStage): DriverTaskStage | null {
  return NEXT_STAGE[stage];
}

export function isDriverTaskProgressStage(
  value: string | null | undefined,
): value is DriverTaskProgressStage {
  return (DRIVER_TASK_PROGRESS as readonly string[]).includes(value ?? "");
}

export function canAdvanceDriverTask(
  current: DriverTaskStage,
  requested: DriverTaskStage,
): boolean {
  return nextDriverTaskStage(current) === requested;
}

/** Public Driver Task stays open this long after BIRAKTIM / completed_at. */
export const DRIVER_TASK_PUBLIC_GRACE_MS = 2 * 60 * 1000;

export function isDriverTaskPublicAccessOpen(input: {
  stage: DriverTaskStage;
  completedAt: Date | string | null | undefined;
  now?: Date;
}): boolean {
  if (input.stage !== "completed") {
    return true;
  }
  if (input.completedAt == null || input.completedAt === "") {
    return false;
  }
  const completedAt = new Date(input.completedAt).getTime();
  if (!Number.isFinite(completedAt)) {
    return false;
  }
  return (input.now ?? new Date()).getTime() < completedAt + DRIVER_TASK_PUBLIC_GRACE_MS;
}

export const DRIVER_TASK_ACTION_LABEL: Record<DriverTaskStage, string | null> = {
  planned: "YOLA ÇIKTIM",
  en_route: "ALIŞ NOKTASINA VARDIM",
  arrived: "YOLCULARI ALDIM",
  picked_up: "YOLCULARI BIRAKTIM",
  completed: null,
};

export function driverAssignmentFingerprint(input: {
  kind?: string | null;
  driverId?: string | null;
  snapshot?: unknown;
}): string {
  const kind = input.kind?.trim() || "";
  if (!kind) {
    return "unassigned";
  }
  const driverId = input.driverId?.trim() || "";
  if (kind === "registered" && driverId) {
    return `registered:${driverId}`;
  }
  const snapshot =
    input.snapshot && typeof input.snapshot === "object"
      ? (input.snapshot as Record<string, unknown>)
      : {};
  const first = String(snapshot.firstName ?? "").trim().toLowerCase();
  const last = String(snapshot.lastName ?? "").trim().toLowerCase();
  const phone = String(snapshot.phone ?? "").replace(/\s+/g, "");
  if (kind === "non_trp") {
    return `non_trp:${first}:${last}:${phone}`;
  }
  return `${kind}:${driverId || `${first}:${last}:${phone}`}`;
}

export {
  DRIVER_TASK_PATH,
  driverTaskPath,
} from "@/lib/driver-routes";
