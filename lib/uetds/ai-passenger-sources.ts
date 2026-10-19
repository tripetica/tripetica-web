import type { UetdsExtractedPassenger } from "@/lib/uetds/extract";
import { tripInstantScore } from "@/lib/uetds/extracted-datetime";

const MISSING_DOCUMENT = "11111111111";

export type AiPassengerSource = UetdsExtractedPassenger;

function documentKey(value: string | undefined) {
  const compact = (value ?? "").replace(/\s+/g, "").toUpperCase();
  if (!compact || compact === MISSING_DOCUMENT) return "";
  return compact;
}

function nameKey(passenger: AiPassengerSource) {
  const lastName = (passenger.lastName ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  const firstName = (passenger.firstName ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!lastName || !firstName) return "";
  return `${lastName}|${firstName}`;
}

/** Same real document number, or the same normalized surname + given names when a number is missing. */
export function sameAiPassenger(left: AiPassengerSource, right: AiPassengerSource) {
  const leftDocument = documentKey(left.identityNumber);
  const rightDocument = documentKey(right.identityNumber);
  if (leftDocument && rightDocument) return leftDocument === rightDocument;
  const leftName = nameKey(left);
  const rightName = nameKey(right);
  return Boolean(leftName && leftName === rightName);
}

function preferFilled<T extends string>(current: T | undefined, incoming: T | undefined) {
  return current?.trim() ? current : incoming;
}

function fillPassenger(current: AiPassengerSource, incoming: AiPassengerSource) {
  current.firstName = preferFilled(current.firstName, incoming.firstName);
  current.lastName = preferFilled(current.lastName, incoming.lastName);
  current.nationality = preferFilled(current.nationality, incoming.nationality);
  current.gender = current.gender ?? incoming.gender;
  const currentDocument = documentKey(current.identityNumber);
  const incomingDocument = documentKey(incoming.identityNumber);
  if (!currentDocument && incomingDocument) current.identityNumber = incoming.identityNumber;
}

/**
 * Append every file's passengers in order.
 * A later file fills blanks on the same person and never removes someone found earlier.
 */
export function mergeAiPassengerSources(groups: AiPassengerSource[][]) {
  const merged: AiPassengerSource[] = [];
  for (const group of groups) {
    for (const passenger of group) {
      if (!passenger.firstName?.trim() && !passenger.lastName?.trim() && !documentKey(passenger.identityNumber)) continue;
      const existing = merged.find((item) => sameAiPassenger(item, passenger));
      if (!existing) {
        merged.push({ ...passenger });
        continue;
      }
      fillPassenger(existing, passenger);
    }
  }
  return merged;
}

type TripSlice = {
  origin?: string;
  destination?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  tripKind?: "transfer" | "tour" | "charter" | "other";
  purpose?: string;
  fare?: string;
  passengerCount?: number;
  passengers?: AiPassengerSource[];
};

/** Keep the first explicit trip value, except a later reservation clock beats a passport birth/issue date. */
export function mergeAiExtractedSources<T extends TripSlice>(parts: T[], nowUtcMs = Date.now()): T {
  const merged = {} as T;
  for (const part of parts) {
    const currentScore = tripInstantScore(merged.startDate as string | undefined, merged.startTime as string | undefined, nowUtcMs);
    const incomingScore = tripInstantScore(part.startDate, part.startTime, nowUtcMs);
    if (incomingScore > currentScore) {
      if (part.startDate) merged.startDate = part.startDate as never;
      else delete merged.startDate;
      if (part.startTime) merged.startTime = part.startTime as never;
    } else {
      if (!merged.startDate && part.startDate && incomingScore >= 0) merged.startDate = part.startDate as never;
      if (!merged.startTime && part.startTime && incomingScore >= 0) merged.startTime = part.startTime as never;
    }
    for (const key of ["origin", "destination", "endDate", "endTime", "tripKind", "purpose", "fare"] as const) {
      if (!merged[key] && part[key]) merged[key] = part[key] as never;
    }
    const stated = part.passengerCount ?? 0;
    if (stated > (merged.passengerCount ?? 0)) merged.passengerCount = stated;
  }
  merged.passengers = mergeAiPassengerSources(parts.map((part) => part.passengers ?? []));
  return merged;
}
