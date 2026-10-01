import { normalizeUetdsFare } from "@/lib/uetds/fare";
import { officialUetdsCountryByCode } from "@/lib/uetds/official-locations";
import { partnerPassengerIdentityFields } from "@/lib/partner/job-view";
import {
  emptyUetdsLocation,
  isOfficialUetdsLocationReady,
  locationFromPlaceName,
  parseUetdsLocation,
  uetdsLocationLabel,
  type UetdsLocation,
} from "@/lib/uetds/location";
import { applyManualUetdsTripDefaults, uetdsTripTimeIssues } from "@/lib/uetds/trip-time";

export const UETDS_FIELD_PROVENANCE = [
  "reservation",
  "document",
  "suggested",
  "user",
  "missing",
] as const;

export type UetdsFieldProvenance = (typeof UETDS_FIELD_PROVENANCE)[number];

export const UETDS_TRIP_KINDS = ["transfer", "tour", "charter", "other"] as const;
export type UetdsTripKind = (typeof UETDS_TRIP_KINDS)[number];

export const UETDS_IDENTITY_TYPES = ["tc", "passport", "other"] as const;
export type UetdsIdentityType = (typeof UETDS_IDENTITY_TYPES)[number];

export const UETDS_DRAFT_SOURCES = ["manual", "reservation"] as const;
export type UetdsDraftSource = (typeof UETDS_DRAFT_SOURCES)[number];

export type UetdsPassengerField = "nationality" | "identityNumber" | "firstName" | "lastName" | "gender";

export type UetdsPassengerDraft = {
  key: string;
  nationality: string;
  identityType: UetdsIdentityType;
  identityNumber: string;
  firstName: string;
  lastName: string;
  gender: "" | "male" | "female";
  ministryReference: string | null;
  provenance: Record<UetdsPassengerField, UetdsFieldProvenance>;
};

export type UetdsTripField =
  | "origin"
  | "destination"
  | "startDate"
  | "startTime"
  | "endDate"
  | "endTime"
  | "groupName"
  | "purpose"
  | "fare"
  | "driverId"
  | "vehicleId";

export type UetdsDraft = {
  source: UetdsDraftSource;
  reservationId: string | null;
  origin: string;
  destination: string;
  originLocation: UetdsLocation;
  destinationLocation: UetdsLocation;
  originReview: boolean;
  destinationReview: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  tripKind: UetdsTripKind;
  groupName: string;
  purpose: string;
  fare: string;
  driverId: string;
  vehicleId: string;
  endManual: boolean;
  passengers: UetdsPassengerDraft[];
  fieldProvenance: Record<UetdsTripField, UetdsFieldProvenance>;
};

export type UetdsFieldConflict = {
  path: string;
  label: string;
  current: string;
  incoming: string;
};

export type UetdsDraftIssue =
  | "trip"
  | "passengers"
  | "identity"
  | "fleet"
  | "suggested";

export function emptyPassengerProvenance(): Record<UetdsPassengerField, UetdsFieldProvenance> {
  return {
    nationality: "missing",
    identityNumber: "missing",
    firstName: "missing",
    lastName: "missing",
    gender: "missing",
  };
}

export function emptyTripProvenance(): Record<UetdsTripField, UetdsFieldProvenance> {
  return {
    origin: "missing",
    destination: "missing",
    startDate: "missing",
    startTime: "missing",
    endDate: "missing",
    endTime: "missing",
    groupName: "missing",
    purpose: "missing",
    fare: "missing",
    driverId: "missing",
    vehicleId: "missing",
  };
}

export function createPassengerDraft(
  input: Partial<UetdsPassengerDraft> & { key?: string } = {},
): UetdsPassengerDraft {
  return {
    key: input.key || createPassengerKey(),
    nationality: input.nationality?.trim() ?? "",
    identityType: input.identityType ?? "passport",
    identityNumber: input.identityNumber?.trim() ?? "",
    firstName: input.firstName?.trim() ?? "",
    lastName: input.lastName?.trim() ?? "",
    gender: input.gender === "male" || input.gender === "female" || input.gender === "" ? input.gender : "female",
    ministryReference: input.ministryReference?.trim() || null,
    provenance: { ...emptyPassengerProvenance(), ...input.provenance },
  };
}

export function createEmptyDraft(
  source: UetdsDraftSource = "manual",
  options: { nowUtcMs?: number; applyTripDefaults?: boolean } = {},
): UetdsDraft {
  const applyDefaults = options.applyTripDefaults ?? source === "manual";
  const times = applyDefaults
    ? applyManualUetdsTripDefaults(options.nowUtcMs ?? Date.now())
    : {
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        endManual: false,
      };
  return {
    source,
    reservationId: null,
    origin: "",
    destination: "",
    originLocation: emptyUetdsLocation(),
    destinationLocation: emptyUetdsLocation(),
    originReview: false,
    destinationReview: false,
    startDate: times.startDate,
    startTime: times.startTime,
    endDate: times.endDate,
    endTime: times.endTime,
    tripKind: "transfer",
    groupName: "",
    purpose: purposeForTripKind("transfer"),
    fare: "",
    driverId: "",
    vehicleId: "",
    endManual: times.endManual,
    passengers: [createPassengerDraft()],
    fieldProvenance: emptyTripProvenance(),
  };
}

export function createPassengerKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pax-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function identityTypeFromValue(value: string | null | undefined): UetdsIdentityType {
  const fields = partnerPassengerIdentityFields(value);
  if (fields.nationalId) {
    return "tc";
  }
  if (fields.passportNumber) {
    return "passport";
  }
  return "passport";
}

export function ensurePassengerCount(passengers: UetdsPassengerDraft[], count: number) {
  const next = passengers.slice(0, Math.max(count, 0));
  while (next.length < count) {
    next.push(createPassengerDraft());
  }
  return next.length > 0 ? next : [createPassengerDraft()];
}

export function markUserEdited<T extends UetdsFieldProvenance>(
  current: T,
  nextValue: string,
  previousValue: string,
): UetdsFieldProvenance {
  if (nextValue.trim() === previousValue.trim()) {
    return current;
  }
  return nextValue.trim() ? "user" : "missing";
}

export function purposeForTripKind(kind: UetdsTripKind) {
  if (kind === "transfer") {
    return "Transfer";
  }
  if (kind === "tour") {
    return "Tur";
  }
  if (kind === "charter") {
    return "Tahsis";
  }
  return "";
}

/** Group description is only Transfer, Tur, or Tahsis. Anything else, including an empty or "Diğer" value, is Transfer. */
export function canonicalGroupPurpose(input: { tripKind?: string | null; purpose?: string | null }): {
  tripKind: "transfer" | "tour" | "charter";
  purpose: "Transfer" | "Tur" | "Tahsis";
} {
  const kind = (input.tripKind ?? "").trim().toLocaleLowerCase("tr-TR");
  const purpose = (input.purpose ?? "").trim().toLocaleLowerCase("tr-TR");
  if (kind === "tour" || purpose === "tur" || purpose === "tour") {
    return { tripKind: "tour", purpose: "Tur" };
  }
  if (kind === "charter" || purpose === "tahsis" || purpose === "charter") {
    return { tripKind: "charter", purpose: "Tahsis" };
  }
  return { tripKind: "transfer", purpose: "Transfer" };
}

export function countSuggestedFields(draft: UetdsDraft) {
  let count = 0;
  for (const value of Object.values(draft.fieldProvenance)) {
    if (value === "suggested") {
      count += 1;
    }
  }
  for (const passenger of draft.passengers) {
    for (const value of Object.values(passenger.provenance)) {
      if (value === "suggested") {
        count += 1;
      }
    }
  }
  return count;
}

export function syncDraftLocations(draft: UetdsDraft): UetdsDraft {
  const originLocation = parseUetdsLocation(draft.originLocation);
  const destinationLocation = parseUetdsLocation(draft.destinationLocation);
  if (!originLocation.placeName && draft.origin.trim()) {
    Object.assign(originLocation, locationFromPlaceName(draft.origin));
  }
  if (!destinationLocation.placeName && draft.destination.trim()) {
    Object.assign(destinationLocation, locationFromPlaceName(draft.destination));
  }
  return {
    ...draft,
    originLocation,
    destinationLocation,
    origin: uetdsLocationLabel(originLocation) || draft.origin,
    destination: uetdsLocationLabel(destinationLocation) || draft.destination,
    originReview: originLocation.review,
    destinationReview: destinationLocation.review,
    endManual: Boolean(draft.endManual),
  };
}

export function parseUetdsDraft(raw: unknown): UetdsDraft | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const value = raw as Partial<UetdsDraft>;
  if (!isUetdsDraftSource(String(value.source ?? ""))) {
    return null;
  }
  if (!Array.isArray(value.passengers)) {
    return null;
  }
  return syncDraftLocations({
    source: value.source as UetdsDraftSource,
    reservationId: value.reservationId?.trim() || null,
    origin: String(value.origin ?? ""),
    destination: String(value.destination ?? ""),
    originLocation: parseUetdsLocation(value.originLocation),
    destinationLocation: parseUetdsLocation(value.destinationLocation),
    originReview: Boolean(value.originReview),
    destinationReview: Boolean(value.destinationReview),
    startDate: String(value.startDate ?? ""),
    startTime: String(value.startTime ?? ""),
    endDate: String(value.endDate ?? ""),
    endTime: String(value.endTime ?? ""),
    tripKind: isUetdsTripKind(String(value.tripKind ?? "")) ? (value.tripKind as UetdsTripKind) : "transfer",
    groupName: String(value.groupName ?? ""),
    purpose: String(value.purpose ?? ""),
    fare: normalizeUetdsFare(String(value.fare ?? "")) ?? String(value.fare ?? ""),
    driverId: String(value.driverId ?? ""),
    vehicleId: String(value.vehicleId ?? ""),
    endManual: Boolean(value.endManual),
    passengers: value.passengers.map((passenger) => createPassengerDraft(passenger)),
    fieldProvenance: { ...emptyTripProvenance(), ...value.fieldProvenance },
  });
}

export function sanitizeUetdsDraftForStorage(raw: unknown): UetdsDraft | null {
  return parseUetdsDraft(raw);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function missingMandatoryFields(draft: UetdsDraft) {
  const current = syncDraftLocations(draft);
  const missing: string[] = [];
  if (!isOfficialUetdsLocationReady(current.originLocation)) {
    missing.push("origin");
  }
  if (!isOfficialUetdsLocationReady(current.destinationLocation)) {
    missing.push("destination");
  }
  if (!validDate(current.startDate)) {
    missing.push("startDate");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(current.startTime)) {
    missing.push("startTime");
  }
  if (!validDate(current.endDate)) {
    missing.push("endDate");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(current.endTime)) {
    missing.push("endTime");
  }
  if (!current.purpose.trim()) {
    missing.push("purpose");
  }
  if (normalizeUetdsFare(current.fare) === null) missing.push("fare");
  if (!current.driverId.trim()) {
    missing.push("driverId");
  }
  if (!current.vehicleId.trim()) {
    missing.push("vehicleId");
  }
  if (current.passengers.length === 0) {
    missing.push("passengers");
  }
  current.passengers.forEach((passenger, index) => {
    if (!passenger.firstName.trim()) missing.push(`passenger.${index}.firstName`);
    if (!passenger.lastName.trim()) missing.push(`passenger.${index}.lastName`);
    if (!officialUetdsCountryByCode(passenger.nationality)) {
      missing.push(`passenger.${index}.nationality`);
    }
    if (!passenger.identityNumber.trim()) {
      missing.push(`passenger.${index}.identity`);
    }
    if (passenger.gender !== "female" && passenger.gender !== "male") {
      missing.push(`passenger.${index}.gender`);
    }
  });
  return missing;
}

export function blockingUetdsDraftIssues(draft: UetdsDraft) {
  return [...missingMandatoryFields(draft), ...uetdsTripTimeIssues(draft)];
}

export function isUetdsTripKind(value: string): value is UetdsTripKind {
  return (UETDS_TRIP_KINDS as readonly string[]).includes(value);
}

export function isUetdsDraftSource(value: string): value is UetdsDraftSource {
  return (UETDS_DRAFT_SOURCES as readonly string[]).includes(value);
}
