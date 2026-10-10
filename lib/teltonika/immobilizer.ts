import { TELTONIKA_DOUT1_AVL_ID } from "@/lib/teltonika/codec12";
import { type GpsPresence } from "@/lib/gps/presence";

export const IMMOBILIZER_COMMAND_TIMEOUT_MS = 45_000;
export const IMMOBILIZER_DUPLICATE_MS = 5_000;
export const IMMOBILIZER_MAX_SPEED_MPS = 1;
export const FMB920_FIRMWARE = "03.27.14.Rev.00";

export type ImmobilizerRequest = "off" | "on";
export type ImmobilizerOutput = "unknown" | "off" | "on";
export type ImmobilizerPhase =
  | "none"
  | "withheld"
  | "queued"
  | "sent"
  | "acknowledged"
  | "rejected"
  | "timeout";
export type ImmobilizerView = "unknown" | "pending" | "active" | "passive" | "error" | "offline";

export type ImmobilizerPanel = {
  deviceId: string;
  request: ImmobilizerRequest;
  output: ImmobilizerOutput;
  phase: ImmobilizerPhase;
  commandAt: string | null;
  lastHeartbeatAt: string | null;
  view: ImmobilizerView;
};

export function setIgnDigoutAvailable(firmware: string | null) {
  if (!firmware) return false;
  const match = firmware.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (major !== 3) return major > 3;
  if (minor !== 28) return minor > 28;
  return patch >= 3;
}

export type TrackerModel = "fmb920" | "fmc920";

export function trackerModel(value: unknown): TrackerModel | null {
  if (value === "fmb920" || value === "fmc920") return value;
  return null;
}

export function immobilizerCommandText(request: ImmobilizerRequest, model: TrackerModel) {
  if (model !== "fmb920" && model !== "fmc920") return null;
  return request === "on" ? "setdigout 1" : "setdigout 0";
}

export function doutDispatchAllowed(env: Record<string, string | undefined>) {
  return env.NODE_ENV !== "production"
    && env.EXPECTED_DATABASE === "tripetica_dev"
    && env.TELTONIKA_DOUT_DISPATCH === "dev-approved";
}

export function immobilizerDuplicate(
  last: { request: ImmobilizerRequest; phase: ImmobilizerPhase; ageMs: number } | null,
  request: ImmobilizerRequest,
) {
  if (!last) return false;
  if (last.phase === "queued" || last.phase === "sent") return true;
  return last.request === request && last.ageMs >= 0 && last.ageMs < IMMOBILIZER_DUPLICATE_MS;
}

export function planImmobilizerCommand(input: {
  request: ImmobilizerRequest;
  model: TrackerModel | null;
  speedMps: number | null;
  env: Record<string, string | undefined>;
}) {
  const commandText = input.model ? immobilizerCommandText(input.request, input.model) : null;
  if (!commandText) {
    return { commandText: "", phase: "rejected" as const, reason: "unsupported_model" };
  }
  if (!doutDispatchAllowed(input.env)) {
    return { commandText, phase: "withheld" as const, reason: "dispatch_closed" };
  }
  if (input.speedMps === null || !Number.isFinite(input.speedMps)) {
    return { commandText, phase: "rejected" as const, reason: "speed_unknown" };
  }
  if (input.speedMps >= IMMOBILIZER_MAX_SPEED_MPS) {
    return { commandText, phase: "rejected" as const, reason: "moving" };
  }
  return { commandText, phase: "queued" as const, reason: "ready" };
}

export function immobilizerView(input: {
  presence: GpsPresence;
  output: ImmobilizerOutput;
  phase: ImmobilizerPhase;
  commandAgeMs: number | null;
}): ImmobilizerView {
  if (input.presence !== "online") return "offline";
  const waiting = input.phase === "queued" || input.phase === "sent";
  if (waiting && (input.commandAgeMs === null || input.commandAgeMs <= IMMOBILIZER_COMMAND_TIMEOUT_MS)) {
    return "pending";
  }
  if (input.phase === "rejected" || input.phase === "timeout" || waiting) return "error";
  if (input.output === "on") return "active";
  if (input.output === "off") return "passive";
  return "unknown";
}

export function immobilizerControlAllowed(input: {
  surface: "ops" | "partner";
  opsCanManage: boolean;
  partnerIsPrimary: boolean;
  actorPartnerId: string | null;
  devicePartnerId: string | null;
  deviceReceiver: string | null;
  vehicleId: string | null;
  deviceVehicleId: string | null;
  deviceCount: number;
}) {
  if (input.deviceReceiver !== "teltonika" || input.deviceCount !== 1) return false;
  if (!input.vehicleId || input.deviceVehicleId !== input.vehicleId) return false;
  if (!input.devicePartnerId) return false;
  if (input.surface === "ops") return input.opsCanManage;
  return input.partnerIsPrimary && input.actorPartnerId === input.devicePartnerId;
}

export function dout1FromValues(values: readonly (number | null)[]) {
  let state: ImmobilizerOutput = "unknown";
  for (const value of values) {
    if (value === 0) state = "off";
    else if (value === 1) state = "on";
  }
  return state;
}

export function dout1Readings(records: readonly { io: readonly { id: number; value: number | null }[] }[]) {
  const values: (number | null)[] = [];
  for (const record of records) {
    for (const item of record.io) {
      if (item.id === TELTONIKA_DOUT1_AVL_ID) values.push(item.value);
    }
  }
  const state = dout1FromValues(values);
  return state === "unknown" ? null : state;
}
