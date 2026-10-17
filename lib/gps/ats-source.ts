export const ATS_MINISTRY_SOURCES = ["physical", "mobile", "none"] as const;

export type AtsMinistrySource = (typeof ATS_MINISTRY_SOURCES)[number];

export type AtsSourceAudit = {
  oldSource: AtsMinistrySource;
  newSource: AtsMinistrySource;
  changedAt: string;
  actorName: string;
};

export function atsSlotLockKey(vehicleId: string) {
  return `ats-slot:${vehicleId}`;
}

export function parseAtsMinistrySource(value: string): AtsMinistrySource | null {
  const token = value.trim().toLowerCase();
  return ATS_MINISTRY_SOURCES.includes(token as AtsMinistrySource) ? (token as AtsMinistrySource) : null;
}

/**
 * Subscriptions keep both GPS feeds recording. This chooses the one ministry
 * send, and never falls back to the other feed.
 */
export function ministryAtsFeed(input: {
  source: AtsMinistrySource;
  gpsAtsEnabled: boolean;
  mobileEnabled: boolean;
}): "physical" | "mobile" | "none" {
  if (input.source === "physical" && input.gpsAtsEnabled) return "physical";
  if (input.source === "mobile" && input.mobileEnabled) return "mobile";
  return "none";
}

export function atsSourceSelectable(input: {
  source: AtsMinistrySource;
  gpsAtsEnabled: boolean;
  mobileEnabled: boolean;
}) {
  if (input.source === "none") return true;
  if (input.source === "physical") return input.gpsAtsEnabled;
  return input.mobileEnabled;
}

export type AtsSourceCloseConfirm = "switch" | "stop";

/**
 * Turning off the subscription of the source that is still selected needs an
 * explicit switch to the other feed or an explicit stop. A matching source
 * change in the same save is the explicit choice.
 */
export function planAtsSourceSave(input: {
  currentSource: AtsMinistrySource;
  nextSource: AtsMinistrySource;
  gpsAtsEnabled: boolean;
  mobileEnabled: boolean;
  confirm: string;
}):
  | { ok: true; source: AtsMinistrySource }
  | { ok: false; error: "ats-source-invalid" | "ats-source-close"; closing: "physical" | "mobile" | null } {
  const closing = closingSource(input);
  if (!atsSourceSelectable({ ...input, source: input.nextSource })) {
    return { ok: false, error: "ats-source-invalid", closing };
  }
  if (!closing) return { ok: true, source: input.nextSource };
  const other: AtsMinistrySource = closing === "physical" ? "mobile" : "physical";
  const otherEnabled = other === "mobile" ? input.mobileEnabled : input.gpsAtsEnabled;
  if (input.confirm === "switch" && input.nextSource === other && otherEnabled) {
    return { ok: true, source: other };
  }
  if (input.confirm === "stop" && input.nextSource === "none") {
    return { ok: true, source: "none" };
  }
  return { ok: false, error: "ats-source-close", closing };
}

function closingSource(input: {
  currentSource: AtsMinistrySource;
  gpsAtsEnabled: boolean;
  mobileEnabled: boolean;
}): "physical" | "mobile" | null {
  if (input.currentSource === "physical" && !input.gpsAtsEnabled) return "physical";
  if (input.currentSource === "mobile" && !input.mobileEnabled) return "mobile";
  return null;
}
