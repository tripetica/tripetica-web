import { classifyTeltonikaGetparam, parseTeltonikaGetparam, redactTeltonikaReply, setparamRejected } from "@/lib/teltonika/config-read";
import { configuratorSectionGroups, parameterById, type ParameterLevel } from "@/lib/teltonika/parameters";

export type ConfigValues = Record<string, string>;

const NUMERIC_VALUE = /^[0-9]+(?:\.[0-9]+)?$/;
const OPTION_VALUE = /^(-?\d+(?:\.\d+)?)\s*[–-]\s+\S/;
const TEXT_VALUE = /^[^\n;]{1,160}$/;

export type PlannedChange = {
  id: number;
  from: string;
  to: string;
  level: ParameterLevel;
};

/** Device overrides replace the same IDs. They are not deleted by a later standard version. */
export function mergeConfig(standard: ConfigValues, override: ConfigValues | null): ConfigValues {
  return { ...(override ? { ...standard, ...override } : standard) };
}

export type ParameterControl = "text" | "number" | "select";

export function parameterChoices(parameter: { options: readonly string[] }) {
  return parameter.options.flatMap((option) => {
    const match = option.match(/^(-?\d+(?:\.\d+)?)\s*[–-]\s+(.+)$/);
    return match ? [{ value: match[1] ?? "", label: option }] : [];
  });
}

export function parameterControl(parameter: { type: string; options: readonly string[] }): ParameterControl {
  if (/char|string/i.test(parameter.type)) return "text";
  if (parameter.options.filter((option) => OPTION_VALUE.test(option)).length >= 2) return "select";
  return "number";
}

function textLimit(parameter: { max: string }) {
  const max = Number(parameter.max);
  return Number.isInteger(max) && max > 0 ? Math.min(max, 160) : 160;
}

export type ConfigRejection = {
  id: string;
  reason: "empty" | "charset" | "length" | "number" | "range" | "choice";
};

/** A value may be written with setparam only when the catalog documents it. */
export function parameterValueApplicable(
  parameter: { type: string; options: readonly string[]; min: string; max: string },
  value: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (parameterControl(parameter) === "text") return !/[\n;]/.test(trimmed) && trimmed.length <= textLimit(parameter);
  if (!NUMERIC_VALUE.test(trimmed)) return false;
  const numeric = Number(trimmed);
  const min = Number(parameter.min);
  const max = Number(parameter.max);
  if (!Number.isFinite(numeric) || (Number.isFinite(min) && numeric < min) || (Number.isFinite(max) && numeric > max)) return false;
  const choices = parameterChoices(parameter);
  return choices.length < 2 || choices.some((choice) => configValuesEqual(choice.value, trimmed));
}

/**
 * A device can return a number the catalog does not name.
 * The draft may keep that number. setparam does not send it.
 * 11703 value 2 stays a device reading. It is not a saved choice.
 */
export function unverifiedObservedValue(
  parameter: { type: string; options: readonly string[]; min: string; max: string },
  raw: string | undefined,
) {
  if (raw === undefined || raw.trim() === "") return null;
  if (parameterControl(parameter) === "text") return null;
  const number = comparableNumber(raw) ?? labeledNumber(raw);
  if (number === null) return null;
  const canonical = String(number);
  return parameterValueApplicable(parameter, canonical) ? null : canonical;
}

/** Catalog-outside numbers may be selected, except 11703, whose only saved choices are 0 and 1. */
export function savedChoiceObservations(
  parameter: { id: number; type: string; options: readonly string[]; min: string; max: string },
  raw: string | undefined,
) {
  if (parameter.id === 11703) return null;
  return unverifiedObservedValue(parameter, raw);
}

/** Device-column text for a 11703 reading the catalog does not name. */
export function deviceCatalogOutsideText(
  parameter: { id: number; type: string; options: readonly string[]; min: string; max: string },
  raw: string | undefined,
  label: string,
) {
  if (parameter.id !== 11703 || !label.trim()) return null;
  const canonical = unverifiedObservedValue(parameter, raw);
  return canonical ? `${canonical} – ${label}` : null;
}

export function sanitizeConfigValues(input: ConfigValues, _criticalApproved = false) {
  const values: ConfigValues = {};
  const rejected: ConfigRejection[] = [];
  for (const [key, raw] of Object.entries(input)) {
    const parameter = /^\d+$/.test(key) ? parameterById(Number(key)) : null;
    const value = raw.trim();
    if (!parameter || !value) {
      rejected.push({ id: key, reason: "empty" });
      continue;
    }
    if (parameterValueApplicable(parameter, value)) {
      values[key] = value;
      continue;
    }
    if (parameterControl(parameter) === "text") {
      rejected.push({ id: key, reason: /[\n;]/.test(value) ? "charset" : "length" });
      continue;
    }
    if (!NUMERIC_VALUE.test(value)) rejected.push({ id: key, reason: "number" });
    else {
      const numeric = Number(value);
      const min = Number(parameter.min);
      const max = Number(parameter.max);
      const outOfRange = !Number.isFinite(numeric) || (Number.isFinite(min) && numeric < min) || (Number.isFinite(max) && numeric > max);
      rejected.push({ id: key, reason: outOfRange ? "range" : "choice" });
    }
  }
  return { values, rejected };
}

export function configDraftForSave(draft: ConfigValues, previous: ConfigValues, _criticalApproved: boolean) {
  const next: ConfigValues = {};
  for (const source of [previous, draft]) {
    for (const [key, value] of Object.entries(source)) {
      const parameter = /^\d+$/.test(key) ? parameterById(Number(key)) : null;
      if (!parameter || !value.trim()) continue;
      next[key] = value;
    }
  }
  return retainUnverifiedObservations(sanitizeConfigValues(next, true), next, previous);
}

/** Keep a catalog-unnamed number only when that same number was already stored or read from a device. */
export function retainUnverifiedObservations(
  clean: { values: ConfigValues; rejected: ConfigRejection[] },
  submitted: ConfigValues,
  allowed: ConfigValues,
) {
  const rejected = clean.rejected.filter((item) => {
    const parameter = /^\d+$/.test(item.id) ? parameterById(Number(item.id)) : null;
    if (!parameter || parameter.id === 11703) return true;
    const wanted = savedChoiceObservations(parameter, submitted[item.id]);
    const permitted = savedChoiceObservations(parameter, allowed[item.id]);
    if (!wanted || wanted !== permitted) return true;
    clean.values[item.id] = wanted;
    return false;
  });
  return { values: clean.values, rejected };
}

/** Profile rows may be stored on the DEV database and on production. Device commands stay closed. */
export function profileSaveAllowed(database: string) {
  return database === "tripetica" || database === "tripetica_dev";
}

/** A manual getparam may be queued on DEV and on production. It does not open apply. */
export function manualReadAllowed(database: string) {
  return database === "tripetica" || database === "tripetica_dev";
}

export function configValuesEqual(left: string, right: string) {
  const leftNumber = comparableNumber(left);
  const rightNumber = comparableNumber(right);
  if (leftNumber !== null && rightNumber !== null) return leftNumber === rightNumber;
  return left.trim() === right.trim();
}

function comparableNumber(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function labeledNumber(value: string) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*[–-]\s+\S/);
  return match?.[1] ? comparableNumber(match[1]) : null;
}

function choiceNumber(parameter: { options: readonly string[] }, value: string) {
  const direct = comparableNumber(value);
  if (direct !== null) return direct;
  const label = value.trim();
  const match = parameterChoices(parameter).find((choice) => choice.label.trim() === label);
  if (match) return comparableNumber(match.value);
  return labeledNumber(value);
}

/**
 * A missing or blank device read is not a difference.
 * Choice labels compare by their catalog number. Decimals ignore a comma and trailing zeros.
 */
export function parameterValuesDiffer(
  parameter: { type: string; options: readonly string[] },
  deviceValue: string | undefined,
  fieldValue: string,
) {
  if (deviceValue === undefined || deviceValue.trim() === "") return false;
  if (parameterControl(parameter) === "text") return deviceValue.trim() !== fieldValue.trim();
  const deviceNumber = choiceNumber(parameter, deviceValue);
  const fieldNumber = choiceNumber(parameter, fieldValue);
  if (deviceNumber !== null && fieldNumber !== null) return deviceNumber !== fieldNumber;
  return deviceValue.trim() !== fieldValue.trim();
}

/** The catalog option label when this value is one of the parameter's choices. Otherwise the raw value. */
export function deviceParameterText(
  parameter: { type: string; options: readonly string[] },
  raw: string | undefined,
) {
  if (raw === undefined || raw.trim() === "") return null;
  if (parameterControl(parameter) !== "select") return raw.trim();
  const match = parameterChoices(parameter).find((choice) => choice.label.trim() === raw.trim() || configValuesEqual(choice.value, raw));
  return match ? match.label : raw.trim();
}

const IMPORT_OUTPUT_SECTIONS = new Set([
  "Immobilizer scenario parameters",
  "DOUT control via call scenario parameters",
  "DOUT 1 Output type",
]);
const IMPORT_DRIVING_SECTIONS = new Set([
  "Green driving parameters",
  "Overspeeding scenario parameters",
  "Excessive Idling",
]);
const IMPORT_ACQUISITION_SECTIONS = new Set<string>(
  configuratorSectionGroups.find((group) => group.id === "acquisition")?.sections ?? [],
);
const IMPORT_CONNECTION_NAMES = new Set([
  "APN",
  "APN username",
  "APN password",
  "GPRS Authentication",
  "Domain",
  "Port",
  "Protocol",
  "Backup Server Mode",
  "Backup Server Domain",
  "Backup Server Port",
  "Backup Server Protocol",
  "Auto APN Search",
  "FOTA WEB Domain",
  "FOTA WEB Port",
]);
const IMPORT_CADENCE_NAMES = new Set([
  "Sleep settings",
  "Periodic Wakeup",
  "Bluetooth On While In Sleep",
  "Low Power Mode",
  "Min Period",
  "GPS Search Period",
  "GPS Accuracy (HDOP PDOP VDOP)",
  "GPS Satellites Quantity",
  "Hold GPS Fix Timeout",
  "Send/Save records without TS",
  "Data Protocol",
]);

/** Connection, immobilizer, driving, idle, cadence, and secret rows stay on their saved values. */
export function configImportHeld(parameter: { section: string; name: string }) {
  if (IMPORT_DRIVING_SECTIONS.has(parameter.section) || IMPORT_OUTPUT_SECTIONS.has(parameter.section)) return true;
  if (IMPORT_ACQUISITION_SECTIONS.has(parameter.section)) return true;
  if (parameter.section === "GPRS parameters" && IMPORT_CONNECTION_NAMES.has(parameter.name)) return true;
  if (IMPORT_CADENCE_NAMES.has(parameter.name)) return true;
  if (/password|username|keyword|login|sas key/i.test(parameter.name)) return true;
  if (/\bDOUT\b|Output control|Digital Output/i.test(parameter.name)) return true;
  return false;
}

function canonicalParameterValue(parameter: { type: string; options: readonly string[] }, raw: string) {
  const trimmed = raw.trim();
  if (parameterControl(parameter) === "text") return trimmed;
  const match = parameterChoices(parameter).find((choice) => choice.label.trim() === trimmed || configValuesEqual(choice.value, trimmed));
  if (match && parameterControl(parameter) === "select") return match.value;
  const number = comparableNumber(trimmed);
  return number === null ? trimmed : String(number);
}

export type DeviceReadImport = {
  values: ConfigValues;
  transferred: number;
  unchanged: number;
};

/** Copy verified device values into the draft. Held, unread, and invalid values stay as they are. */
export function importDeviceReadIntoDraft(input: {
  draft: ConfigValues;
  deviceValues: ConfigValues;
  parameters: readonly { id: number; section: string; name: string; type: string; options: readonly string[]; min: string; max: string }[];
}): DeviceReadImport {
  const next: ConfigValues = { ...input.draft };
  let transferred = 0;
  let unchanged = 0;
  const byId = new Map(input.parameters.map((parameter) => [String(parameter.id), parameter]));
  for (const [key, raw] of Object.entries(input.deviceValues)) {
    const parameter = byId.get(key);
    if (!parameter || raw.trim() === "" || configImportHeld(parameter)) {
      unchanged += 1;
      continue;
    }
    const canonical = canonicalParameterValue(parameter, raw);
    const accepted = sanitizeConfigValues({ [key]: canonical }).values[key] ?? savedChoiceObservations(parameter, canonical);
    if (!accepted) {
      unchanged += 1;
      continue;
    }
    next[key] = accepted;
    transferred += 1;
  }
  return { values: next, transferred, unchanged };
}

export const CURRENT_DEVICE_READ_MS = 15 * 60 * 1000;

export function deviceReadIsCurrent(readAt: string | null, now = Date.now()) {
  if (!readAt) return false;
  const time = Date.parse(readAt);
  return Number.isFinite(time) && time <= now && now - time <= CURRENT_DEVICE_READ_MS;
}

export function deviceReadLabel(input: {
  selectedCount: number;
  status: string | null;
  readAt: string | null;
  hasValues: boolean;
  now?: number;
}) {
  if (input.selectedCount > 1) return "multiple" as const;
  if (input.selectedCount !== 1) return "hidden" as const;
  const dated = Boolean(input.readAt);
  if (!input.status || (!input.hasValues && input.status !== "pending")) return "missing" as const;
  if (input.status === "pending") return dated ? "waiting-stale" as const : "waiting" as const;
  if (input.status === "failed") return dated ? "failed-stale" as const : "failed" as const;
  if (input.status === "partial") return deviceReadIsCurrent(input.readAt, input.now) ? "partial" as const : "partial-stale" as const;
  if (!deviceReadIsCurrent(input.readAt, input.now)) return "stale" as const;
  return "current" as const;
}

const CONNECTION_SECTIONS = new Set(["GPRS parameters", "SMS/Call settings"]);
const SAFETY_SECTIONS = new Set([
  "Immobilizer scenario parameters",
  "DOUT control via call scenario parameters",
  "DOUT 1 Output type",
]);
const COMMAND_TOKEN = /^[^\s;]{1,160}$/;

function applyBucket(parameter: { id: number; section: string }): "ordinary" | "connection" | "safety" {
  if (parameter.id === 11003 || SAFETY_SECTIONS.has(parameter.section)) return "safety";
  if (CONNECTION_SECTIONS.has(parameter.section)) return "connection";
  return "ordinary";
}

/**
 * Ordinary, connection, and vehicle-safety diffs stay in separate lists.
 * A missing read is not a match. Immobilizer and DOUT never become a command here.
 */
export function planConfigChanges(input: {
  current: ConfigValues;
  target: ConfigValues;
}): {
  changes: PlannedChange[];
  connection: PlannedChange[];
  safety: PlannedChange[];
  unread: string[];
  connectionCommand: string | null;
} {
  const changes: PlannedChange[] = [];
  const connection: PlannedChange[] = [];
  const safety: PlannedChange[] = [];
  const unread: string[] = [];
  for (const [key, targetValue] of Object.entries(input.target)) {
    const parameter = /^\d+$/.test(key) ? parameterById(Number(key)) : null;
    const current = input.current[key];
    if (!parameter || !parameterValueApplicable(parameter, targetValue)) continue;
    if (current === undefined) {
      unread.push(key);
      continue;
    }
    if (configValuesEqual(current, targetValue)) continue;
    const change = { id: parameter.id, from: current, to: targetValue, level: parameter.level };
    const bucket = applyBucket(parameter);
    if (bucket === "safety") safety.push(change);
    else if (bucket === "connection") connection.push(change);
    else changes.push(change);
  }
  return {
    changes,
    connection,
    safety,
    unread,
    connectionCommand: unread.length > 0 ? null : formatConnectionCommand(connection),
  };
}

/** A missing read is never treated as a match. Safety diffs are kept and are not encoded. */
export function classifyApply(input: { read: ConfigValues | null; target: ConfigValues }) {
  const empty = { changes: [] as PlannedChange[], connection: [] as PlannedChange[], safety: [] as PlannedChange[], connectionCommand: null as string | null };
  if (!input.read) return { phase: "waiting_link" as const, error: "unread" as const, ...empty };
  const plan = planConfigChanges({ current: input.read, target: input.target });
  const pending = plan.unread.length > 0 || plan.changes.length > 0 || plan.connection.length > 0 || plan.safety.length > 0;
  if (!pending) return { phase: "no_change" as const, error: null, ...empty };
  if (plan.unread.length > 0 || plan.changes.length > 0 || plan.connection.length > 0) {
    return {
      phase: "waiting_link" as const,
      error: plan.unread.length > 0 ? "unread" as const : null,
      changes: plan.changes,
      connection: plan.connection,
      safety: plan.safety,
      connectionCommand: plan.unread.length > 0 ? null : plan.connectionCommand,
    };
  }
  return { phase: "waiting_link" as const, error: "vehicle_safety" as const, ...empty, safety: plan.safety };
}

/** Automatic sync stays inert while dispatch is closed. It does not attach connection or safety commands. */
export function planAutomaticSync(input: { read: ConfigValues | null; approved: ConfigValues; override: ConfigValues | null }) {
  if (!configDispatchEnabled() || !input.read) {
    return { command: null, connectionCommand: null, changes: [] as PlannedChange[], connection: [] as PlannedChange[], safety: [] as PlannedChange[] };
  }
  const plan = planConfigChanges({ current: input.read, target: mergeConfig(input.approved, input.override) });
  return {
    command: plan.unread.length > 0 ? null : formatConfigSetparam(plan.changes),
    connectionCommand: null,
    changes: plan.changes,
    connection: plan.connection,
    safety: plan.safety,
  };
}

/** Server, port, APN, and SMS use their own command. A value outside the verified token grammar holds the whole command. */
export function formatConnectionCommand(changes: readonly PlannedChange[]) {
  if (changes.length === 0 || changes.some((change) => !COMMAND_TOKEN.test(change.to))) return null;
  return `setparam ${changes.map((change) => `${change.id}:${change.to}`).join(";")}`;
}

/** Formats a non-critical diff. Returns null when there is nothing safe to write. */
export function formatConfigSetparam(changes: readonly PlannedChange[]) {
  const applicable = changes.filter((change) => {
    const parameter = parameterById(change.id);
    return parameter !== null && parameterValueApplicable(parameter, change.to);
  });
  if (applicable.length === 0 || applicable.some((change) => change.level === "critical" || !NUMERIC_VALUE.test(change.to))) return null;
  return `setparam ${applicable.map((change) => `${change.id}:${change.to}`).join(";")}`;
}

const COMMAND_CHUNK = 24;
const READ_NARROW_CHUNK = 6;
export const CONFIGURATOR_READ_ATTEMPT_LIMIT = 3;
export const CONFIGURATOR_READ_COMMAND_LIMIT = 160;
const READ_TRACE_LIMIT = 12;

export type ReadStatus = "read" | "unsupported" | "empty" | "device_error" | "parse_error" | "timeout" | "unresolved";

function chunkCommand(prefix: "getparam" | "setparam", parts: readonly string[]) {
  const steps: string[] = [];
  for (let index = 0; index < parts.length; index += COMMAND_CHUNK) {
    const slice = parts.slice(index, index + COMMAND_CHUNK);
    if (slice.length > 0) steps.push(`${prefix} ${slice.join(";")}`);
  }
  return steps;
}

/** A catalog getparam or setparam. setdigout is the immobilizer command and is refused here. */
export function configuratorWireCommandAllowed(text: string) {
  if (/setdigout|setigndigout/i.test(text)) return false;
  const read = /^getparam ([0-9;]+)$/.exec(text);
  if (read?.[1]) {
    const ids = read[1].split(";");
    return ids.length > 0 && ids.every((id) => parameterById(Number(id)) !== null);
  }
  if (!text.startsWith("setparam ")) return false;
  const body = text.slice("setparam ".length);
  if (!body || body !== body.trim()) return false;
  const parts = body.split(";");
  return parts.length > 0 && parts.every((part) => {
    const match = /^(\d+):([^\n;]{1,160})$/.exec(part);
    if (!match?.[1] || !match[2] || match[2] !== match[2].trim()) return false;
    const parameter = parameterById(Number(match[1]));
    if (!parameter) return false;
    return parameterValueApplicable(parameter, match[2]);
  });
}

/** One device read, split so a single Codec 12 frame stays small. */
export function planConfiguratorRead(ids: readonly number[]) {
  const parts = [...new Set(ids)].filter((id) => parameterById(id)).sort((left, right) => left - right).map(String);
  return chunkCommand("getparam", parts);
}

export function configuratorReadPlan(ids: readonly number[], version: number): ConfiguratorJobPlan {
  const steps = planConfiguratorRead(ids);
  return {
    kind: "read",
    version,
    steps,
    step: 0,
    values: {},
    target: {},
    expect: [...new Set(steps.flatMap((step) => commandIds(step)))],
    outcomes: {},
    attempts: {},
    traces: [],
  };
}

export type DeviceDispatch = {
  phase: "waiting_link" | "no_change";
  error: "vehicle_safety" | null;
  steps: string[];
  expect: string[];
  changes: PlannedChange[];
  connection: PlannedChange[];
  safety: PlannedChange[];
};

/**
 * Apply does not wait for a prior read. A known equal value is skipped.
 * A missing value is written, then checked by the trailing getparam.
 * Output configuration (11003, immobilizer scenario, DOUT settings) is its own setparam.
 * The direct immobilizer command, setdigout, is never built here.
 */
export function planDeviceDispatch(input: { read: ConfigValues | null; target: ConfigValues }): DeviceDispatch {
  const changes: PlannedChange[] = [];
  const connection: PlannedChange[] = [];
  const output: PlannedChange[] = [];
  const safety: PlannedChange[] = [];
  for (const [key, targetValue] of Object.entries(input.target)) {
    const parameter = /^\d+$/.test(key) ? parameterById(Number(key)) : null;
    if (!parameter) continue;
    const current = input.read?.[key];
    const bucket = applyBucket(parameter);
    if (input.read && current !== undefined && configValuesEqual(current, targetValue)) continue;
    if (!parameterValueApplicable(parameter, targetValue)) {
      if (bucket === "safety") safety.push({ id: parameter.id, from: current ?? "", to: targetValue, level: parameter.level });
      continue;
    }
    const textValue = parameterControl(parameter) === "text" && TEXT_VALUE.test(targetValue);
    if (!textValue && !COMMAND_TOKEN.test(targetValue)) {
      if (bucket === "safety") safety.push({ id: parameter.id, from: current ?? "", to: targetValue, level: parameter.level });
      continue;
    }
    const change = { id: parameter.id, from: current ?? "", to: targetValue, level: parameter.level };
    if (bucket === "connection") connection.push(change);
    else if (bucket === "safety") output.push(change);
    else changes.push(change);
  }
  const written = [...changes, ...connection, ...output];
  if (written.length === 0) {
    return {
      phase: "no_change",
      error: safety.length > 0 ? "vehicle_safety" : null,
      steps: [],
      expect: [],
      changes,
      connection,
      safety,
    };
  }
  const expect = written.map((change) => String(change.id));
  return {
    phase: "waiting_link",
    error: null,
    steps: [
      ...chunkCommand("setparam", changes.map((change) => `${change.id}:${change.to}`)),
      ...chunkCommand("setparam", connection.map((change) => `${change.id}:${change.to}`)),
      ...chunkCommand("setparam", output.map((change) => `${change.id}:${change.to}`)),
      ...chunkCommand("getparam", expect),
    ],
    expect,
    changes,
    connection,
    safety,
  };
}

export type ConfiguratorJobPlan = {
  kind: "read" | "apply" | "auto" | "parameter";
  version: number;
  steps: string[];
  step: number;
  values: ConfigValues;
  target: ConfigValues;
  expect: string[];
  outcomes?: Record<string, ReadStatus>;
  attempts?: Record<string, number>;
  traces?: string[];
  parameterId?: number;
  from?: string;
  rollback?: string | null;
  rollbackUsed?: boolean;
  restoring?: boolean;
};

const READ_STATUSES = new Set<ReadStatus>(["read", "unsupported", "empty", "device_error", "parse_error", "timeout", "unresolved"]);

export function parseConfiguratorPlan(value: unknown): ConfiguratorJobPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "read" && record.kind !== "apply" && record.kind !== "auto" && record.kind !== "parameter") return null;
  if (!Array.isArray(record.steps) || !record.steps.every((item) => typeof item === "string")) return null;
  const parameter = record.kind === "parameter" ? parameterPlanFields(record) : null;
  if (record.kind === "parameter" && !parameter) return null;
  const outcomes: Record<string, ReadStatus> = {};
  if (record.outcomes && typeof record.outcomes === "object" && !Array.isArray(record.outcomes)) {
    for (const [key, item] of Object.entries(record.outcomes)) {
      if (typeof item === "string" && READ_STATUSES.has(item as ReadStatus)) outcomes[key] = item as ReadStatus;
    }
  }
  const attempts: Record<string, number> = {};
  if (record.attempts && typeof record.attempts === "object" && !Array.isArray(record.attempts)) {
    for (const [key, item] of Object.entries(record.attempts)) {
      if (typeof item === "number" && Number.isInteger(item) && item >= 0) attempts[key] = item;
    }
  }
  const traces = Array.isArray(record.traces)
    ? record.traces.filter((item): item is string => typeof item === "string").slice(0, READ_TRACE_LIMIT)
    : [];
  return {
    kind: record.kind,
    version: typeof record.version === "number" ? record.version : 0,
    steps: record.steps,
    step: typeof record.step === "number" ? record.step : 0,
    values: asPlanValues(record.values),
    target: asPlanValues(record.target),
    expect: Array.isArray(record.expect) ? record.expect.filter((item): item is string => typeof item === "string") : [],
    outcomes,
    attempts,
    traces,
    parameterId: parameter?.parameterId,
    from: parameter?.from ?? "",
    rollback: parameter?.rollback ?? null,
    rollbackUsed: parameter?.rollbackUsed === true,
    restoring: parameter?.restoring === true,
  };
}

function parameterPlanFields(record: Record<string, unknown>) {
  const parameterId = record.parameterId;
  if (typeof parameterId !== "number" || !Number.isInteger(parameterId)) return null;
  const parameter = parameterById(parameterId);
  const steps = record.steps;
  if (!parameter || !Array.isArray(steps) || steps.length > 6 || !steps.every((step) => typeof step === "string" && parameterStepMatches(parameterId, step))) return null;
  const rollback = typeof record.rollback === "string" ? applicableRollback(parameterId, record.rollback) : null;
  return {
    parameterId,
    from: typeof record.from === "string" ? record.from : "",
    rollback,
    rollbackUsed: record.rollbackUsed === true,
    restoring: record.restoring === true,
  };
}

function parameterStepMatches(parameterId: number, step: string) {
  const id = String(parameterId);
  if (step === `getparam ${id}`) return true;
  const match = new RegExp(`^setparam ${id}:([^\\n;]{1,160})$`).exec(step);
  const parameter = parameterById(parameterId);
  return Boolean(match?.[1] && match[1] === match[1].trim() && parameter && parameterValueApplicable(parameter, match[1]));
}

function asPlanValues(value: unknown): ConfigValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const values: ConfigValues = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") values[key] = item;
  }
  return values;
}

function commandIds(command: string) {
  if (!command.startsWith("getparam ")) return [];
  return command.slice("getparam ".length).split(";").filter((id) => id.length > 0);
}

function trackedReadIds(plan: ConfiguratorJobPlan) {
  if ((plan.expect?.length ?? 0) > 0) return plan.expect ?? [];
  return [...new Set(plan.steps.flatMap((step) => commandIds(step)))];
}

function secretRead(id: string) {
  const parameter = /^\d+$/.test(id) ? parameterById(Number(id)) : null;
  return Boolean(parameter && /password|username|keyword|login/i.test(parameter.name));
}

function narrowerRead(size: number) {
  if (size > READ_NARROW_CHUNK) return READ_NARROW_CHUNK;
  if (size > 1) return 1;
  return 0;
}

function readCommands(ids: readonly string[], size: number) {
  const steps: string[] = [];
  for (let index = 0; index < ids.length; index += size) steps.push(`getparam ${ids.slice(index, index + size).join(";")}`);
  return steps;
}

export function readOutcomeTotals(plan: Pick<ConfiguratorJobPlan, "expect" | "steps" | "values" | "outcomes">) {
  const ids = (plan.expect?.length ?? 0) > 0 ? plan.expect ?? [] : [...new Set(plan.steps.flatMap((step) => commandIds(step)))];
  const totals = { read: 0, unsupported: 0, empty: 0, failed: 0, unresolved: 0, total: ids.length };
  for (const id of ids) {
    const status = plan.outcomes?.[id] ?? (plan.values[id] !== undefined ? "read" : undefined);
    if (status === "read") totals.read += 1;
    else if (status === "unsupported") totals.unsupported += 1;
    else if (status === "empty") totals.empty += 1;
    else if (status === "device_error" || status === "parse_error" || status === "timeout") totals.failed += 1;
    else if (status === "unresolved") totals.unresolved += 1;
  }
  return totals;
}

/**
 * One getparam reply updates only the IDs in that command.
 * Missing IDs are asked again in a smaller group, then one at a time.
 * A timeout is not multiplied, and the command list cannot grow without a limit.
 */
function advanceManualRead(plan: ConfiguratorJobPlan, response: string, timeout = false): {
  plan: ConfiguratorJobPlan;
  phase: "waiting_link" | "verified" | "failed";
  error: string | null;
} {
  const ready = { ...plan, outcomes: { ...(plan.outcomes ?? {}) }, attempts: { ...(plan.attempts ?? {}) }, traces: [...(plan.traces ?? [])] };
  if (ready.step <= 0 || ready.step > ready.steps.length) return { plan: ready, phase: "failed", error: "unparsed" };
  const requested = commandIds(ready.steps[ready.step - 1] ?? "");
  const classified = classifyTeltonikaGetparam(response, { timeout });
  const attempts = { ...ready.attempts };
  for (const id of requested) attempts[id] = (attempts[id] ?? 0) + 1;
  const outcomes = { ...ready.outcomes };
  const values = { ...ready.values };
  for (const id of requested) {
    if (classified.values[id] === undefined) continue;
    outcomes[id] = "read";
    if (!secretRead(id)) values[id] = classified.values[id];
  }
  for (const id of classified.empty) {
    if (!requested.includes(id)) continue;
    outcomes[id] = "empty";
    delete values[id];
  }
  for (const id of classified.missing) {
    if (!requested.includes(id) || outcomes[id] !== undefined) continue;
    outcomes[id] = "unsupported";
    delete values[id];
  }
  const retry = classified.reply === "timeout" || classified.reply === "blocked"
    ? []
    : requested.filter((id) => outcomes[id] === undefined && (attempts[id] ?? 0) < CONFIGURATOR_READ_ATTEMPT_LIMIT);
  const width = narrowerRead(requested.length);
  let steps = ready.steps;
  const scheduled = new Set<string>();
  if (retry.length > 0 && width > 0) {
    const room = CONFIGURATOR_READ_COMMAND_LIMIT - steps.length;
    const inserted = readCommands(retry, width).slice(0, Math.max(0, room));
    for (const id of inserted.flatMap((step) => commandIds(step))) scheduled.add(id);
    steps = [...steps.slice(0, ready.step), ...inserted, ...steps.slice(ready.step)];
  }
  for (const id of requested) {
    if (outcomes[id] !== undefined || scheduled.has(id)) continue;
    outcomes[id] = terminalReadStatus(classified.reply, requested.length);
  }
  let trace = redactTeltonikaReply(timeout ? "timeout" : response);
  for (const id of requested) {
    const value = classified.values[id];
    if (value && secretRead(id)) trace = trace.split(value).join("•••");
  }
  const traces = trace ? [...ready.traces, trace].slice(-READ_TRACE_LIMIT) : ready.traces;
  const next = { ...ready, steps, values, outcomes, attempts, traces };
  if (ready.step < steps.length) return { plan: next, phase: "waiting_link", error: null };
  for (const id of trackedReadIds(next)) if (next.outcomes?.[id] === undefined) next.outcomes = { ...next.outcomes, [id]: "unresolved" };
  const totals = readOutcomeTotals(next);
  if (totals.read === totals.total && totals.total > 0) return { plan: next, phase: "verified", error: null };
  if (totals.read + totals.empty + totals.unsupported + totals.failed + totals.unresolved === 0) {
    return { plan: next, phase: "failed", error: "unparsed" };
  }
  return { plan: next, phase: "verified", error: "partial" };
}

function terminalReadStatus(reply: ReturnType<typeof classifyTeltonikaGetparam>["reply"], requested: number): ReadStatus {
  if (reply === "timeout") return "timeout";
  if (reply === "blocked") return "unresolved";
  if (requested === 1 && reply === "not_found") return "unsupported";
  if (requested === 1 && reply === "device_error") return "device_error";
  if (requested === 1 && reply === "unparsed") return "parse_error";
  if (requested === 1 && reply === "empty_reply") return "empty";
  if (reply === "not_found" || reply === "values") return "unresolved";
  if (reply === "device_error") return "device_error";
  if (reply === "unparsed") return "parse_error";
  return "empty";
}

/** Moves a job after one device reply. A sent command is not treated as verified. */
export function advanceConfiguratorJob(plan: ConfiguratorJobPlan, response: string, options?: { timeout?: boolean }): {
  plan: ConfiguratorJobPlan;
  phase: "waiting_link" | "verified" | "unverified" | "failed";
  error: string | null;
} {
  if (plan.kind === "parameter") return advanceParameterApply(plan, response, options);
  if (plan.kind === "read") return advanceManualRead(plan, response, options?.timeout === true);
  if (options?.timeout) return { plan, phase: "failed", error: "timeout" };
  if (!response.trim() || response === "blocked" || setparamRejected(response)) {
    return { plan, phase: "failed", error: response === "blocked" ? "blocked" : "rejected" };
  }
  const parsed = parseTeltonikaGetparam(response);
  if (Object.keys(parsed).length === 0) return { plan, phase: "failed", error: "unparsed" };
  const values = { ...plan.values, ...parsed };
  const next = { ...plan, values };
  if (next.step < next.steps.length) return { plan: next, phase: "waiting_link", error: null };
  const matched = next.expect.every((id) => values[id] !== undefined && configValuesEqual(values[id], next.target[id] ?? ""));
  return { plan: next, phase: matched ? "verified" : "unverified", error: matched ? null : "mismatch" };
}

/** Automatic apply runs only when this device has not already verified the latest saved version. */
export function automaticApplyNeeded(verifiedVersion: number | null, latestVersion: number | null) {
  return latestVersion !== null && verifiedVersion !== latestVersion;
}

/** Automatic profile dispatch stays closed. An explicit getparam read is separate. */
export function productionConfiguratorGetparamAllowed(text: string) {
  return text.startsWith("getparam ") && configuratorWireCommandAllowed(text);
}

/** Automatic apply stays closed on every database. */
export function configDispatchEnabled() {
  return false;
}

/** An explicit one-parameter apply may be queued. Automatic dispatch stays closed. */
export function parameterApplyAllowed(database: string) {
  return database === "tripetica" || database === "tripetica_dev";
}

/** One catalog parameter. A second ID, setdigout, setkey, and delkey are refused. */
export function parameterApplyCommandAllowed(text: string) {
  if (/setdigout|setigndigout|setkey|delkey|cpureset/i.test(text)) return false;
  const read = /^getparam (\d+)$/.exec(text);
  if (read?.[1]) return parameterById(Number(read[1])) !== null;
  const write = /^setparam (\d+):([^\n;]{1,160})$/.exec(text);
  if (!write?.[1] || write[2] === undefined || write[2] !== write[2].trim()) return false;
  const parameter = parameterById(Number(write[1]));
  return Boolean(parameter && parameterValueApplicable(parameter, write[2]));
}

/** Connection, immobilizer, driving, cadence, and secret rows can be restored once. */
export function parameterApplyGuarded(parameter: { id: number; section: string; name: string; level: string }) {
  return applyBucket(parameter) !== "ordinary" || parameter.level === "critical" || configImportHeld(parameter);
}

function applicableRollback(parameterId: number, rollback: string | null | undefined) {
  if (!rollback?.trim()) return null;
  const parameter = parameterById(parameterId);
  if (!parameter || !parameterValueApplicable(parameter, rollback.trim())) return null;
  return rollback.trim();
}

/** Builds one setparam and its getparam. An equal known value produces no command. */
export function planParameterApply(input: { parameterId: number; value: string; previous: string | null }) {
  const parameter = parameterById(input.parameterId);
  if (!parameter || !parameter.remote || parameter.section === "RS232/RS485" || parameter.section === "LVCAN") {
    return { ok: false as const, reason: "unsupported" as const };
  }
  const value = input.value.trim();
  if (!parameterValueApplicable(parameter, value)) return { ok: false as const, reason: "value" as const };
  const id = String(parameter.id);
  const previous = input.previous?.trim() ? input.previous.trim() : null;
  const unchanged = previous !== null && configValuesEqual(previous, value);
  const rollback = unchanged || !parameterApplyGuarded(parameter) ? null : applicableRollback(parameter.id, previous);
  const plan: ConfiguratorJobPlan = {
    kind: "parameter",
    version: 0,
    parameterId: parameter.id,
    from: previous ?? "",
    rollback,
    rollbackUsed: false,
    restoring: false,
    steps: unchanged ? [] : [`setparam ${id}:${value}`, `getparam ${id}`],
    step: 0,
    values: {},
    target: { [id]: value },
    expect: [id],
    attempts: {},
    traces: [],
  };
  return { ok: true as const, unchanged, plan };
}

export function parameterApplyCounts(phases: readonly string[]) {
  const counts = { verified: 0, waiting: 0, failed: 0, unchanged: 0 };
  for (const phase of phases) {
    if (phase === "verified") counts.verified += 1;
    else if (phase === "no_change") counts.unchanged += 1;
    else if (phase === "waiting" || phase === "waiting_link" || phase === "applying" || phase === "verifying" || phase === "reading") counts.waiting += 1;
    else if (phase === "failed" || phase === "unverified" || phase === "unsupported") counts.failed += 1;
  }
  return counts;
}

function advanceParameterApply(plan: ConfiguratorJobPlan, response: string, options?: { timeout?: boolean }): {
  plan: ConfiguratorJobPlan;
  phase: "waiting_link" | "verified" | "unverified" | "failed";
  error: string | null;
} {
  const parameterId = plan.parameterId ?? 0;
  const id = String(parameterId);
  const ready: ConfiguratorJobPlan = {
    ...plan,
    rollback: applicableRollback(parameterId, plan.rollback),
    attempts: { ...(plan.attempts ?? {}) },
    traces: [...(plan.traces ?? [])],
  };
  if (ready.step <= 0 || ready.step > ready.steps.length) return { plan: ready, phase: "failed", error: "unparsed" };
  const command = ready.steps[ready.step - 1] ?? "";
  if (command !== `getparam ${id}` && !command.startsWith(`setparam ${id}:`)) return { plan: ready, phase: "failed", error: "blocked" };
  if (!parameterApplyCommandAllowed(command)) return { plan: ready, phase: "failed", error: "blocked" };
  let trace = redactTeltonikaReply(options?.timeout ? "timeout" : response);
  const hidden = secretRead(id) ? ready.target[id] ?? "" : "";
  if (hidden) trace = trace.split(hidden).join("•••");
  const priorTraces = ready.traces ?? [];
  const traces = trace ? [...priorTraces, trace].slice(-READ_TRACE_LIMIT) : priorTraces;
  const next: ConfiguratorJobPlan = { ...ready, traces };
  const scheduleRead = () => {
    const key = next.restoring ? "rollback-read" : "readback";
    const used = next.attempts?.[key] ?? 0;
    if (used >= 1 || next.steps.length >= 6) return false;
    next.attempts = { ...next.attempts, [key]: used + 1 };
    next.steps = [...next.steps.slice(0, next.step), `getparam ${id}`, ...next.steps.slice(next.step)];
    return true;
  };
  if (options?.timeout) {
    if (command.startsWith("getparam ") && scheduleRead()) return { plan: next, phase: "waiting_link", error: null };
    return { plan: next, phase: "failed", error: "timeout" };
  }
  if (!response.trim() || response === "blocked" || setparamRejected(response)) {
    return { plan: next, phase: "failed", error: response === "blocked" ? "blocked" : response.trim() ? "rejected" : "unparsed" };
  }
  if (command.startsWith("setparam ")) {
    if (next.step >= next.steps.length) return { plan: next, phase: "failed", error: "unparsed" };
    return { plan: next, phase: "waiting_link", error: null };
  }
  const value = parseTeltonikaGetparam(response)[id];
  if (value === undefined) {
    if (scheduleRead()) return { plan: next, phase: "waiting_link", error: null };
    return { plan: next, phase: "failed", error: "unparsed" };
  }
  next.values = { ...next.values, [id]: value };
  if (next.restoring) {
    return configValuesEqual(value, next.rollback ?? "")
      ? { plan: next, phase: "failed", error: "rolled_back" }
      : { plan: next, phase: "failed", error: "rollback_failed" };
  }
  if (configValuesEqual(value, next.target[id] ?? "")) return { plan: next, phase: "verified", error: null };
  const rollback = applicableRollback(parameterId, next.rollback);
  if (rollback && !next.rollbackUsed && next.steps.length + 2 <= 6) {
    next.rollback = rollback;
    next.rollbackUsed = true;
    next.restoring = true;
    next.steps = [...next.steps.slice(0, next.step), `setparam ${id}:${rollback}`, `getparam ${id}`];
    return { plan: next, phase: "waiting_link", error: null };
  }
  return { plan: next, phase: "unverified", error: "mismatch" };
}
