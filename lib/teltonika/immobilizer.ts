import { GPS_ONLINE_MS_DEFAULT, type GpsPresence } from "@/lib/gps/presence";
import { TELTONIKA_DOUT1_AVL_ID, parseGetio, parseSetdigoutReply } from "@/lib/teltonika/codec12";

export const IMMOBILIZER_COMMAND_TIMEOUT_MS = 45_000;
export const IMMOBILIZER_DUPLICATE_MS = 5_000;
export const IMMOBILIZER_ENABLE_CONFIRM_MS = 2 * 60 * 1000;
export const IMMOBILIZER_MAX_SPEED_MPS = 1;
export const IMMOBILIZER_FRESH_MS = GPS_ONLINE_MS_DEFAULT;
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
export type ImmobilizerReadiness = "relay_missing" | "unverified" | "service_disabled" | "ready";
export type ImmobilizerIgnition = "on" | "off" | null;

export type ImmobilizerCapability = {
  hardwareSupported: boolean;
  relayInstalled: boolean;
  installationVerifiedAt: string | null;
  installationVerifiedBy: string | null;
  serviceEnabled: boolean;
  starterCircuitVerified: boolean;
  starterCircuitVerifiedAt: string | null;
  starterCircuitVerifiedBy: string | null;
  readiness: ImmobilizerReadiness;
};

export type ImmobilizerPanel = ImmobilizerCapability & {
  deviceId: string;
  request: ImmobilizerRequest;
  output: ImmobilizerOutput;
  outputObservedAt: string | null;
  phase: ImmobilizerPhase;
  commandAt: string | null;
  commandText: string | null;
  responseText: string | null;
  lastHeartbeatAt: string | null;
  ignition: ImmobilizerIgnition;
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
  // 03.27.14 rejects setigndigout. DOUT ON is the starter-cut state this firmware accepts.
  return request === "on" ? "setdigout 1" : "setdigout 0";
}

export function immobilizerReadiness(input: {
  hardwareSupported: boolean;
  relayInstalled: boolean;
  installationVerified: boolean;
  serviceEnabled: boolean;
}): ImmobilizerReadiness {
  if (!input.hardwareSupported || !input.relayInstalled) return "relay_missing";
  if (!input.installationVerified) return "unverified";
  if (!input.serviceEnabled) return "service_disabled";
  return "ready";
}

export function immobilizerCapabilityChecked(values: readonly string[]) {
  return values.some((value) => value === "yes" || value === "on" || value === "1");
}

export function nextImmobilizerCapability(input: {
  model: TrackerModel | null;
  hardwareSupported: boolean;
  relayInstalled: boolean;
  verified: boolean;
  serviceEnabled: boolean;
  starterCircuitVerified?: boolean;
}) {
  const hardwareSupported = input.model !== null && input.hardwareSupported;
  const relayInstalled = hardwareSupported && input.relayInstalled;
  const verified = relayInstalled && input.verified;
  const serviceEnabled = verified && input.serviceEnabled;
  const starterCircuitVerified = serviceEnabled && input.starterCircuitVerified === true;
  return { hardwareSupported, relayInstalled, verified, serviceEnabled, starterCircuitVerified };
}

export type StarterEffect = "unverified" | "blocked" | "released" | "unknown";

/** DOUT acknowledgement is not physical starter proof. */
export function starterEffect(input: {
  starterCircuitVerified: boolean;
  output: ImmobilizerOutput;
}): StarterEffect {
  void input.starterCircuitVerified;
  if (input.output === "on") return "blocked";
  if (input.output === "off") return "released";
  return "unknown";
}

export function immobilizerDisplayedPhase(phase: ImmobilizerPhase, commandAgeMs: number | null): ImmobilizerPhase {
  if (phase === "sent" && commandAgeMs !== null && commandAgeMs > IMMOBILIZER_COMMAND_TIMEOUT_MS) return "timeout";
  return phase;
}

/** Device reply after a Codec 12 command. Accepted is applied; queued is not applied. */
export function immobilizerReplyPhase(text: string): { phase: "acknowledged" | "sent" | "rejected" | "queued"; output: ImmobilizerOutput } {
  const measured = parseGetio(text);
  if (measured.dout1) return { phase: "acknowledged" as const, output: measured.dout1 };
  if (/QUEUED|IGN\s*ON/i.test(text) && !/IGNORED|disabled from CFG|Bad Syntax|ERR:/i.test(text)) {
    return { phase: "queued" as const, output: "unknown" as const };
  }
  const reply = parseSetdigoutReply(text);
  if (reply.queued) return { phase: "queued" as const, output: "unknown" as const };
  if (reply.accepted && reply.dout1) return { phase: "acknowledged" as const, output: reply.dout1 };
  return { phase: "rejected" as const, output: "unknown" as const };
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
  hardwareSupported?: boolean;
  relayInstalled?: boolean;
  installationVerified?: boolean;
  serviceEnabled?: boolean;
  starterCircuitVerified?: boolean;
  presence?: GpsPresence;
  ignition?: ImmobilizerIgnition;
  gnssAgeMs?: number | null;
}) {
  void input.env;
  void input.presence;
  void input.ignition;
  void input.gnssAgeMs;
  void input.starterCircuitVerified;
  void input.hardwareSupported;
  void input.relayInstalled;
  void input.installationVerified;
  void input.serviceEnabled;
  void input.speedMps;
  const commandText = input.model ? immobilizerCommandText(input.request, input.model) : null;
  if (!commandText) {
    return { commandText: "", phase: "rejected" as const, reason: "unsupported_model" };
  }
  return { commandText, phase: "queued" as const, reason: "ready" };
}

const ENABLE_CONFIRM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Turning the block on needs a server-issued confirmation. A bare confirmed flag is not enough. */
/** A verification record is written only after an explicit physical-measurement confirmation. */
export function starterVerificationDecision(input: {
  intent: string | null;
  physicalMeasurement: string | null;
  clearConfirm: string | null;
}) {
  if (input.intent === "verify" && input.physicalMeasurement === "yes") return "verify" as const;
  if (input.intent === "clear" && input.clearConfirm === "yes") return "clear" as const;
  return "refuse" as const;
}

export function immobilizerEnableGate(confirmationId: string | null | undefined) {
  const id = confirmationId?.trim() ?? "";
  if (!ENABLE_CONFIRM_ID.test(id)) return { ok: false as const, error: "confirm" as const };
  return { ok: true as const, confirmationId: id };
}

export type ImmobilizerSwitchStatus = "active" | "passive" | "pending" | "unknown";

/** The switch follows the verified output. A lost link is unknown, not the last command. */
export function immobilizerSwitchPresentation(input: {
  view: ImmobilizerView;
  output: ImmobilizerOutput;
}): { checked: boolean; indeterminate: boolean; status: ImmobilizerSwitchStatus } {
  if (input.view === "pending") {
    if (input.output === "on") return { checked: true, indeterminate: false, status: "pending" };
    if (input.output === "off") return { checked: false, indeterminate: false, status: "pending" };
    return { checked: false, indeterminate: true, status: "pending" };
  }
  if (input.view === "offline" || input.view === "unknown") {
    return { checked: false, indeterminate: true, status: "unknown" };
  }
  if (input.output === "on" && (input.view === "active" || input.view === "error")) {
    return { checked: true, indeterminate: false, status: "active" };
  }
  if (input.output === "off" && (input.view === "passive" || input.view === "error")) {
    return { checked: false, indeterminate: false, status: "passive" };
  }
  return { checked: false, indeterminate: true, status: "unknown" };
}

export function immobilizerView(input: {
  presence: GpsPresence;
  output: ImmobilizerOutput;
  phase: ImmobilizerPhase;
  commandAgeMs: number | null;
}): ImmobilizerView {
  if (input.presence !== "online") return "offline";
  if (input.phase === "queued") return "pending";
  const waiting = input.phase === "sent";
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
