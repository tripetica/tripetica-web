import { parameterById } from "@/lib/teltonika/parameters";

/** Full Green Driving read. The write command below does not include these other IDs. */
export const TELTONIKA_GREEN_GETPARAM =
  "getparam 11000;11003;11004;11005;11006;11007;11008;11011;11015;11019";

/** Scenario low, advanced/average/maximum off. Thresholds, source, and DOUT stay untouched. */
export const TELTONIKA_GREEN_SETPARAM = "setparam 11000:1;11019:0;11011:0;11015:0";

const IMMOBILIZER_WIRE_COMMANDS = new Set(["setdigout 0", "setdigout 1"]);

/** Codec 12 payload the listener may write. Any other setparam is refused. */
export function teltonikaWireCommandAllowed(text: string) {
  return text === TELTONIKA_GREEN_GETPARAM
    || text === TELTONIKA_GREEN_SETPARAM
    || IMMOBILIZER_WIRE_COMMANDS.has(text);
}

export function teltonikaParamNumber(value: string | undefined) {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const GETPARAM_ID = String.raw`\d{1,6}`;
const GETPARAM_PIECE = new RegExp(`(?:Param ID:)?\\s*(${GETPARAM_ID})\\s*(?:Value:|[:=])\\s*(.*?)\\s*$`, "i");
const SECRET_IDS = new Set(["2002", "2003", "3003", "3004"]);

export type GetparamReplyKind = "values" | "empty_reply" | "not_found" | "device_error" | "unparsed" | "timeout" | "blocked";

export type ClassifiedGetparam = {
  values: Record<string, string>;
  empty: string[];
  missing: string[];
  reply: GetparamReplyKind;
};

function secretParameter(id: string) {
  if (SECRET_IDS.has(id)) return true;
  const parameter = /^\d+$/.test(id) ? parameterById(Number(id)) : null;
  return Boolean(parameter && /password|username|keyword|login/i.test(parameter.name));
}

/** Diagnostic text. Secret parameter values are replaced before anything is stored. */
export function redactTeltonikaReply(text: string) {
  const redacted = text.replace(
    new RegExp(`(?:Param ID:)?\\s*(${GETPARAM_ID})\\s*(Value:|[:=])\\s*([^\\n;]*)`, "gi"),
    (_full, id: string, separator: string, value: string) => `${id}${separator}${secretParameter(id) ? "•••" : value.trim()}`,
  );
  return redacted.slice(0, 180);
}

/**
 * Reads one Codec 12 getparam reply.
 * IDs of 1 to 6 digits are accepted. An empty Value is recorded separately from a missing ID.
 * A group error is not assigned to each ID here; the read plan decides after a smaller query.
 */
export function classifyTeltonikaGetparam(text: string, options?: { timeout?: boolean }): ClassifiedGetparam {
  if (options?.timeout) return { values: {}, empty: [], missing: [], reply: "timeout" };
  const trimmed = text.trim();
  if (!trimmed) return { values: {}, empty: [], missing: [], reply: "empty_reply" };
  if (trimmed === "blocked") return { values: {}, empty: [], missing: [], reply: "blocked" };
  const values: Record<string, string> = {};
  const empty: string[] = [];
  const normalized = trimmed.replace(/New Val:/gi, "Value:");
  for (const piece of normalized.split(/;|(?=Param ID:)/i)) {
    const match = piece.match(GETPARAM_PIECE);
    const id = match?.[1];
    if (!id || values[id] !== undefined || empty.includes(id)) continue;
    const value = match?.[2]?.trim() ?? "";
    if (!value) empty.push(id);
    else values[id] = value;
  }
  const missing: string[] = [];
  for (const match of normalized.matchAll(/Param ID:\s*(\d{1,6})\s+(?:does not exist|doesn['’]t exist)/gi)) {
    const id = match[1];
    if (!id || missing.includes(id) || values[id] !== undefined || empty.includes(id)) continue;
    missing.push(id);
  }
  if (Object.keys(values).length === 0 && empty.length === 0) {
    if (missing.length > 0 || /param id not found|not found|does not exist|doesn't exist|doesn’t exist/i.test(normalized)) {
      return { values, empty, missing, reply: "not_found" };
    }
    if (/ERR:|Bad Syntax|ERROR|Invalid|Unknown/i.test(normalized)) return { values, empty, missing, reply: "device_error" };
    return { values, empty, missing, reply: "unparsed" };
  }
  return { values, empty, missing, reply: "values" };
}

/** Keeps the raw device text. Unknown reply shapes stay unparsed instead of being guessed. */
export function parseTeltonikaGetparam(text: string) {
  return classifyTeltonikaGetparam(text).values;
}

export function greenDrivingReadComplete(values: Record<string, string>) {
  return ["11000", "11003", "11004", "11005", "11006", "11007", "11011", "11015", "11019"]
    .every((id) => teltonikaParamNumber(values[id]) !== null);
}

export function greenDrivingOutputSafe(values: Record<string, string>) {
  return teltonikaParamNumber(values["11003"]) === 0;
}

export function greenDrivingTargetMet(values: Record<string, string>) {
  return teltonikaParamNumber(values["11000"]) === 1
    && teltonikaParamNumber(values["11019"]) === 0
    && teltonikaParamNumber(values["11011"]) === 0
    && teltonikaParamNumber(values["11015"]) === 0;
}

export function setparamRejected(text: string) {
  return /ERR:|Bad Syntax|not found|ERROR|Invalid|Unknown/i.test(text);
}

/** Follow-up after one device reply. A failed verification does not queue another write. */
export function decideGreenDrivingFollowup(input: {
  applyEnabled: boolean;
  command: string;
  response: string;
  priorSetparamAnswered: boolean;
}) {
  if (!input.applyEnabled) return "none" as const;
  if (input.command === TELTONIKA_GREEN_SETPARAM) {
    return setparamRejected(input.response) ? "none" as const : "verify" as const;
  }
  if (input.command !== TELTONIKA_GREEN_GETPARAM) return "none" as const;
  const values = parseTeltonikaGetparam(input.response);
  if (!greenDrivingReadComplete(values) || !greenDrivingOutputSafe(values)) return "none" as const;
  if (greenDrivingTargetMet(values) || input.priorSetparamAnswered) return "none" as const;
  return "setparam" as const;
}
