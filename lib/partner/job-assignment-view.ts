import { phoneValidity, toE164 } from "@/lib/booking/phone";
import { normalizeIso2 } from "@/lib/geo/countries";
import { type Locale } from "@/lib/i18n/config";
import { joinPartnerContactName, splitPartnerContactName } from "@/lib/partner/contact-name";
import { PARTNER_CONTACT_NAME_MAX_LENGTH } from "@/lib/partner/constants";
import {
  formatPartnerDriverLanguagesFull,
  normalizePartnerDriverLanguageCodes,
} from "@/lib/partner/driver-languages";
import {
  formatPartnerFleetPhone,
  partnerDriverFullName,
  type PartnerDriverRecord,
  type PartnerVehicleRecord,
} from "@/lib/partner/fleet-view";
import { partnerVehicleClassLabel } from "@/lib/partner/vehicle-class";
import {
  normalizePartnerPlate,
  PARTNER_VEHICLE_PLATE_MAX,
} from "@/lib/partner/vehicle-policy";

export const NON_TRP_SELECTION = "non_trp";
export const ASSIGNMENT_NOTE_MAX = 500;
export const ASSIGNMENT_BRAND_MODEL_MAX = 160;

export type AssignmentKind = "registered" | "non_trp";

export type NonTrpParseError =
  | "invalid-name"
  | "invalid-phone"
  | "invalid-languages"
  | "invalid-notes"
  | "invalid-plate"
  | "invalid-brand"
  | "invalid-brand-model"
  | "invalid-model"
  | "invalid-year"
  | "invalid-class"
  | "invalid-passengers"
  | "invalid-luggage";

export type AssignmentAccessError =
  | "not-accepted"
  | "locked"
  | "forbidden-non-trp"
  | "foreign-fleet"
  | "invalid-selection";

export type AssignJobError =
  | AssignmentAccessError
  | NonTrpParseError
  | "not-found"
  | "inactive-fleet"
  | "failed";

export type NonTrpDriverSnapshot = {
  firstName: string;
  lastName: string;
  phone: string;
  phoneCountryCode: string;
  languageCodes: string[];
  notes: string | null;
};

export type NonTrpVehicleSnapshot = {
  plate: string;
  brandModel: string;
  features: string | null;
};

export type RegisteredDriverSnapshot = {
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneCountryCode: string | null;
  languageCodes: string[];
  nationalId: string | null;
};

export type RegisteredVehicleSnapshot = {
  plate: string;
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  vehicleClassCode: string | null;
  passengerCapacity: number | null;
  luggageCapacity: number | null;
  color: string | null;
  features: string | null;
};

export type JobDriverAssignmentView = {
  kind: AssignmentKind | null;
  driverId: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  languageCodes: string[];
  nationalId: string | null;
  notes: string | null;
  selection: string;
};

export type JobVehicleAssignmentView = {
  kind: AssignmentKind | null;
  vehicleId: string | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  vehicleClassCode: string | null;
  passengerCapacity: number | null;
  luggageCapacity: number | null;
  color: string | null;
  features: string | null;
  notes: string | null;
  selection: string;
};

export type JobAssignmentView = {
  locked: boolean;
  driver: JobDriverAssignmentView;
  vehicle: JobVehicleAssignmentView;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function textField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  const trimmed = textField(value);
  return trimmed || null;
}

function numberField(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function languageList(value: unknown) {
  if (Array.isArray(value)) {
    return normalizePartnerDriverLanguageCodes(value.map((item) => String(item)));
  }
  if (typeof value === "string") {
    return normalizePartnerDriverLanguageCodes(value.split(","));
  }
  return [];
}

function clipNotes(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isAssignmentLocked(status: string | null | undefined) {
  return status === "cancelled";
}

export function assertAssignmentAccess(input: {
  reservationAcceptedPartnerId: string | null;
  actorPartnerId: string;
  actorIsPrimary: boolean;
  reservationStatus: string | null;
  selectionKind: AssignmentKind;
  fleetPartnerId?: string | null;
}): { ok: true } | { ok: false; error: AssignmentAccessError } {
  if (!input.reservationAcceptedPartnerId) {
    return { ok: false, error: "not-accepted" };
  }
  if (input.reservationAcceptedPartnerId !== input.actorPartnerId) {
    return { ok: false, error: "not-accepted" };
  }
  if (isAssignmentLocked(input.reservationStatus)) {
    return { ok: false, error: "locked" };
  }
  if (input.selectionKind === "non_trp") {
    if (!input.actorIsPrimary) {
      return { ok: false, error: "forbidden-non-trp" };
    }
    return { ok: true };
  }
  if (!input.fleetPartnerId || input.fleetPartnerId !== input.actorPartnerId) {
    return { ok: false, error: "foreign-fleet" };
  }
  return { ok: true };
}

export function assertCanClearAssignment(input: {
  reservationAcceptedPartnerId: string | null;
  actorPartnerId: string;
  reservationStatus: string | null;
}): { ok: true } | { ok: false; error: AssignmentAccessError } {
  if (!input.reservationAcceptedPartnerId) {
    return { ok: false, error: "not-accepted" };
  }
  if (input.reservationAcceptedPartnerId !== input.actorPartnerId) {
    return { ok: false, error: "not-accepted" };
  }
  if (isAssignmentLocked(input.reservationStatus)) {
    return { ok: false, error: "locked" };
  }
  return { ok: true };
}

export function registeredDriverSnapshot(
  driver: PartnerDriverRecord,
): RegisteredDriverSnapshot {
  return {
    firstName: driver.firstName,
    lastName: driver.lastName,
    phone: driver.phone,
    phoneCountryCode: driver.phoneCountryCode,
    languageCodes: driver.languageCodes,
    nationalId: driver.nationalId,
  };
}

export function registeredVehicleSnapshot(
  vehicle: PartnerVehicleRecord,
): RegisteredVehicleSnapshot {
  return {
    plate: vehicle.plate,
    brand: vehicle.brand,
    model: vehicle.model,
    modelYear: vehicle.modelYear,
    vehicleClassCode: vehicle.vehicleClassCode,
    passengerCapacity: vehicle.passengerCapacity,
    luggageCapacity: vehicle.luggageCapacity,
    color: vehicle.color,
    features: vehicle.features,
  };
}

export function parseNonTrpDriverSnapshot(value: unknown): NonTrpDriverSnapshot | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  const firstName = textField(row.firstName);
  const lastName = textField(row.lastName);
  const phone = textField(row.phone);
  const phoneCountryCode = textField(row.phoneCountryCode).toUpperCase();
  const languageCodes = languageList(row.languageCodes);
  if (!firstName || !lastName || !phone || !phoneCountryCode) {
    return null;
  }
  return {
    firstName,
    lastName,
    phone,
    phoneCountryCode,
    languageCodes,
    notes: optionalText(row.notes),
  };
}

export function parseNonTrpVehicleSnapshot(value: unknown): NonTrpVehicleSnapshot | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  const plate = normalizePartnerPlate(textField(row.plate));
  const brandModel =
    textField(row.brandModel) || formatAssignmentVehicleName(textField(row.brand), textField(row.model));
  if (!plate || !brandModel) {
    return null;
  }
  return {
    plate,
    brandModel,
    features: optionalText(row.features) ?? optionalText(row.notes),
  };
}

export function parseRegisteredDriverSnapshot(
  value: unknown,
): RegisteredDriverSnapshot | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  const firstName = textField(row.firstName);
  const lastName = textField(row.lastName);
  if (!firstName && !lastName) {
    return null;
  }
  return {
    firstName,
    lastName,
    phone: optionalText(row.phone),
    phoneCountryCode: optionalText(row.phoneCountryCode),
    languageCodes: languageList(row.languageCodes),
    nationalId: optionalText(row.nationalId),
  };
}

export function parseRegisteredVehicleSnapshot(
  value: unknown,
): RegisteredVehicleSnapshot | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  const plate = textField(row.plate);
  if (!plate) {
    return null;
  }
  return {
    plate,
    brand: optionalText(row.brand),
    model: optionalText(row.model),
    modelYear: numberField(row.modelYear),
    vehicleClassCode: optionalText(row.vehicleClassCode),
    passengerCapacity: numberField(row.passengerCapacity),
    luggageCapacity: numberField(row.luggageCapacity),
    color: optionalText(row.color),
    features: optionalText(row.features),
  };
}

export function parseNonTrpDriverForm(input: {
  fullName: string;
  existingFirst?: string;
  existingLast?: string;
  phoneCountryCode: string;
  phoneNational: string;
  languageCodes: readonly string[];
  notes: string;
}): { ok: true; value: NonTrpDriverSnapshot } | { ok: false; error: NonTrpParseError } {
  const submitted = input.fullName.trim().replace(/\s+/g, " ");
  const existingJoined = joinPartnerContactName(input.existingFirst, input.existingLast);
  let firstName = "";
  let lastName = "";
  if (submitted && existingJoined && submitted === existingJoined) {
    firstName = (input.existingFirst ?? "").trim();
    lastName = (input.existingLast ?? "").trim();
  } else {
    const split = splitPartnerContactName(submitted);
    if (split) {
      firstName = split.contactFirstName;
      lastName = split.contactLastName;
    } else if (submitted) {
      firstName = submitted;
    }
  }
  if (
    !firstName ||
    !lastName ||
    firstName.length > PARTNER_CONTACT_NAME_MAX_LENGTH ||
    lastName.length > PARTNER_CONTACT_NAME_MAX_LENGTH
  ) {
    return { ok: false, error: "invalid-name" };
  }
  const phoneCountryCode = normalizeIso2(input.phoneCountryCode);
  if (!phoneCountryCode || phoneValidity(phoneCountryCode, input.phoneNational) !== "valid") {
    return { ok: false, error: "invalid-phone" };
  }
  const phone = toE164(phoneCountryCode, input.phoneNational);
  if (!phone) {
    return { ok: false, error: "invalid-phone" };
  }
  const languageCodes = normalizePartnerDriverLanguageCodes(input.languageCodes);
  if (languageCodes.length === 0) {
    return { ok: false, error: "invalid-languages" };
  }
  const notes = clipNotes(input.notes);
  if (notes.length > ASSIGNMENT_NOTE_MAX) {
    return { ok: false, error: "invalid-notes" };
  }
  return {
    ok: true,
    value: {
      firstName,
      lastName,
      phone,
      phoneCountryCode,
      languageCodes,
      notes: notes || null,
    },
  };
}

export function parseNonTrpVehicleForm(input: {
  plate: string;
  brandModel: string;
  features: string;
}): { ok: true; value: NonTrpVehicleSnapshot } | { ok: false; error: NonTrpParseError } {
  const plate = normalizePartnerPlate(input.plate);
  if (!plate || plate.length > PARTNER_VEHICLE_PLATE_MAX) {
    return { ok: false, error: "invalid-plate" };
  }
  const brandModel = input.brandModel.trim().replace(/\s+/g, " ");
  if (!brandModel || brandModel.length > ASSIGNMENT_BRAND_MODEL_MAX) {
    return { ok: false, error: "invalid-brand-model" };
  }
  const features = clipNotes(input.features);
  if (features.length > ASSIGNMENT_NOTE_MAX) {
    return { ok: false, error: "invalid-notes" };
  }
  return {
    ok: true,
    value: {
      plate,
      brandModel,
      features: features || null,
    },
  };
}

export function emptyDriverAssignment(): JobDriverAssignmentView {
  return {
    kind: null,
    driverId: null,
    firstName: null,
    lastName: null,
    fullName: null,
    phone: null,
    phoneCountryCode: null,
    languageCodes: [],
    nationalId: null,
    notes: null,
    selection: "",
  };
}

export function emptyVehicleAssignment(): JobVehicleAssignmentView {
  return {
    kind: null,
    vehicleId: null,
    plate: null,
    brand: null,
    model: null,
    modelYear: null,
    vehicleClassCode: null,
    passengerCapacity: null,
    luggageCapacity: null,
    color: null,
    features: null,
    notes: null,
    selection: "",
  };
}

export function resolveDriverAssignment(input: {
  kind: string | null;
  driverId: string | null;
  snapshot: unknown;
  live: PartnerDriverRecord | null;
}): JobDriverAssignmentView {
  if (input.kind === "non_trp") {
    const snapshot = parseNonTrpDriverSnapshot(input.snapshot);
    if (!snapshot) {
      return {
        ...emptyDriverAssignment(),
        kind: "non_trp",
        selection: NON_TRP_SELECTION,
      };
    }
    return {
      kind: "non_trp",
      driverId: null,
      firstName: snapshot.firstName,
      lastName: snapshot.lastName,
      fullName: partnerDriverFullName(snapshot.firstName, snapshot.lastName),
      phone: snapshot.phone,
      phoneCountryCode: snapshot.phoneCountryCode,
      languageCodes: snapshot.languageCodes,
      nationalId: null,
      notes: snapshot.notes,
      selection: NON_TRP_SELECTION,
    };
  }
  if (input.kind === "registered") {
    const snapshot = parseRegisteredDriverSnapshot(input.snapshot);
    const live = input.live;
    const firstName = live?.firstName || snapshot?.firstName || "";
    const lastName = live?.lastName || snapshot?.lastName || "";
    return {
      kind: "registered",
      driverId: live?.id || input.driverId,
      firstName: firstName || null,
      lastName: lastName || null,
      fullName: partnerDriverFullName(firstName, lastName) || null,
      phone: live?.phone ?? snapshot?.phone ?? null,
      phoneCountryCode: live?.phoneCountryCode ?? snapshot?.phoneCountryCode ?? null,
      languageCodes: live?.languageCodes ?? snapshot?.languageCodes ?? [],
      nationalId: live?.nationalId ?? snapshot?.nationalId ?? null,
      notes: null,
      selection: live?.id || input.driverId || "",
    };
  }
  return emptyDriverAssignment();
}

export function resolveVehicleAssignment(input: {
  kind: string | null;
  vehicleId: string | null;
  snapshot: unknown;
  live: PartnerVehicleRecord | null;
}): JobVehicleAssignmentView {
  if (input.kind === "non_trp") {
    const snapshot = parseNonTrpVehicleSnapshot(input.snapshot);
    if (!snapshot) {
      return {
        ...emptyVehicleAssignment(),
        kind: "non_trp",
        selection: NON_TRP_SELECTION,
      };
    }
    return {
      kind: "non_trp",
      vehicleId: null,
      plate: snapshot.plate,
      brand: snapshot.brandModel,
      model: null,
      modelYear: null,
      vehicleClassCode: null,
      passengerCapacity: null,
      luggageCapacity: null,
      color: null,
      features: snapshot.features,
      notes: null,
      selection: NON_TRP_SELECTION,
    };
  }
  if (input.kind === "registered") {
    const snapshot = parseRegisteredVehicleSnapshot(input.snapshot);
    const live = input.live;
    return {
      kind: "registered",
      vehicleId: live?.id || input.vehicleId,
      plate: live?.plate || snapshot?.plate || null,
      brand: live?.brand ?? snapshot?.brand ?? null,
      model: live?.model ?? snapshot?.model ?? null,
      modelYear: live?.modelYear ?? snapshot?.modelYear ?? null,
      vehicleClassCode: live?.vehicleClassCode ?? snapshot?.vehicleClassCode ?? null,
      passengerCapacity: live?.passengerCapacity ?? snapshot?.passengerCapacity ?? null,
      luggageCapacity: live?.luggageCapacity ?? snapshot?.luggageCapacity ?? null,
      color: live?.color ?? snapshot?.color ?? null,
      features: live?.features ?? snapshot?.features ?? null,
      notes: null,
      selection: live?.id || input.vehicleId || "",
    };
  }
  return emptyVehicleAssignment();
}

export function formatAssignmentLanguageCodes(codes: readonly string[]) {
  return normalizePartnerDriverLanguageCodes(codes)
    .map((code) => code.toUpperCase())
    .join(", ");
}

export function formatAssignmentVehicleName(brand: string | null, model: string | null) {
  return [brand, model]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

export function formatDriverAssignmentLines(input: {
  driver: JobDriverAssignmentView;
  unassignedLabel: string;
  nonTrpLabel: string;
}) {
  if (!input.driver.kind) {
    return [input.unassignedLabel];
  }
  const lines: string[] = [];
  if (input.driver.kind === "non_trp") {
    lines.push(input.nonTrpLabel);
  }
  if (input.driver.fullName) {
    lines.push(input.driver.fullName);
  }
  if (input.driver.phone) {
    lines.push(formatPartnerFleetPhone(input.driver.phone));
  }
  const languages = formatAssignmentLanguageCodes(input.driver.languageCodes);
  if (languages) {
    lines.push(languages);
  }
  return lines.length > 0 ? lines : [input.unassignedLabel];
}

export function formatVehicleAssignmentLines(input: {
  vehicle: JobVehicleAssignmentView;
  locale: Locale;
  unassignedLabel: string;
  nonTrpLabel: string;
}) {
  if (!input.vehicle.kind) {
    return [input.unassignedLabel];
  }
  const lines: string[] = [];
  if (input.vehicle.kind === "non_trp") {
    lines.push(input.nonTrpLabel);
  }
  if (input.vehicle.plate) {
    lines.push(input.vehicle.plate);
  }
  const name = formatAssignmentVehicleName(input.vehicle.brand, input.vehicle.model);
  if (name) {
    lines.push(name);
  }
  if (input.vehicle.kind === "non_trp") {
    const features = input.vehicle.features?.trim() || input.vehicle.notes?.trim() || "";
    if (features) {
      lines.push(features);
    }
  } else if (input.vehicle.vehicleClassCode) {
    lines.push(partnerVehicleClassLabel(input.vehicle.vehicleClassCode, input.locale));
  }
  return lines.length > 0 ? lines : [input.unassignedLabel];
}

export function formatDriverLanguagesDisplay(codes: readonly string[], locale: Locale) {
  return formatPartnerDriverLanguagesFull(codes, locale);
}

export function assignmentDriverOptionLabel(driver: PartnerDriverRecord) {
  return partnerDriverFullName(driver.firstName, driver.lastName);
}

export function assignmentVehicleOptionLabel(
  vehicle: PartnerVehicleRecord,
  locale: Locale,
) {
  const parts = [
    vehicle.plate,
    formatAssignmentVehicleName(vehicle.brand, vehicle.model),
    vehicle.modelYear != null ? String(vehicle.modelYear) : "",
    vehicle.vehicleClassCode
      ? partnerVehicleClassLabel(vehicle.vehicleClassCode, locale)
      : "",
  ].filter((part) => part.trim());
  return parts.join(" · ");
}

export function assignmentVehicleListOptionLabel(vehicle: PartnerVehicleRecord) {
  return [vehicle.plate, formatAssignmentVehicleName(vehicle.brand, vehicle.model)]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
}

export function buildDriverAssignmentOptions(
  drivers: readonly PartnerDriverRecord[],
  locale: Locale,
  isPrimaryPartner: boolean,
  nonTrpLabel: string,
) {
  const registered = [...drivers]
    .sort((left, right) =>
      assignmentDriverOptionLabel(left).localeCompare(
        assignmentDriverOptionLabel(right),
        locale,
        { sensitivity: "base" },
      ),
    )
    .map((driver) => ({
      value: driver.id,
      label: assignmentDriverOptionLabel(driver),
    }));
  if (isPrimaryPartner) {
    return [{ value: NON_TRP_SELECTION, label: nonTrpLabel }, ...registered];
  }
  return registered;
}

export function buildVehicleAssignmentOptions(
  vehicles: readonly PartnerVehicleRecord[],
  locale: Locale,
  isPrimaryPartner: boolean,
  nonTrpLabel: string,
  compact = false,
) {
  const registered = [...vehicles]
    .sort((left, right) => left.plate.localeCompare(right.plate, locale, { sensitivity: "base" }))
    .map((vehicle) => ({
      value: vehicle.id,
      label: compact
        ? assignmentVehicleListOptionLabel(vehicle)
        : assignmentVehicleOptionLabel(vehicle, locale),
    }));
  if (isPrimaryPartner) {
    return [{ value: NON_TRP_SELECTION, label: nonTrpLabel }, ...registered];
  }
  return registered;
}

export function listDriverAssignmentSummary(
  driver: JobDriverAssignmentView,
  nonTrpLabel: string,
) {
  if (!driver.kind) {
    return null;
  }
  return {
    kindLabel: driver.kind === "non_trp" ? nonTrpLabel : null,
    title: driver.fullName?.trim() || "",
    subtitle: driver.phone ? formatPartnerFleetPhone(driver.phone) : null,
  };
}

export function listVehicleAssignmentSummary(
  vehicle: JobVehicleAssignmentView,
  nonTrpLabel: string,
) {
  if (!vehicle.kind) {
    return null;
  }
  return {
    kindLabel: vehicle.kind === "non_trp" ? nonTrpLabel : null,
    title: vehicle.plate?.trim() || "",
    subtitle: formatAssignmentVehicleName(vehicle.brand, vehicle.model) || null,
  };
}
