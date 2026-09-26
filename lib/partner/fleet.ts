import "server-only";

import { query } from "@/lib/db/postgres";
import { isValidEmail, phoneValidity, toE164 } from "@/lib/booking/phone";
import { normalizePartnerEmail } from "@/lib/partner/email";
import { normalizeIso2 } from "@/lib/geo/countries";
import { joinPartnerContactName, splitPartnerContactName } from "@/lib/partner/contact-name";
import { PARTNER_CONTACT_NAME_MAX_LENGTH } from "@/lib/partner/constants";
import { isDriverNationalIdValid, normalizeDriverNationalId } from "@/lib/partner/driver-identity";
import { normalizePartnerDriverLanguageCodes } from "@/lib/partner/driver-languages";
import {
  isPartnerFleetAssignable,
  mapUetdsCompanyLink,
  partnerDriverFullName,
  type PartnerDriverRecord,
  type PartnerFleetStatus,
  type PartnerVehicleRecord,
  type PartnerVehicleStatus,
} from "@/lib/partner/fleet-view";
import {
  nextPartnerVehicleStatus,
  parsePartnerVehicleInput,
  partnerCreateVehicleStatus,
} from "@/lib/partner/vehicle-policy";
import { vehicleClassRequiresApproval } from "@/lib/partner/vehicle-class";

export type {
  PartnerDriverRecord,
  PartnerFleetStatus,
  PartnerVehicleRecord,
} from "@/lib/partner/fleet-view";
export {
  isPartnerFleetAssignable,
  partnerDriverFullName,
  partnerVehicleBrandModel,
} from "@/lib/partner/fleet-view";

export type PartnerFleetEditor =
  | { source: "ops"; userId: string }
  | { source: "partner"; userId: string };

type DriverRow = {
  id: string;
  partner_id: string;
  first_name: string;
  last_name: string;
  national_id: string | null;
  phone: string | null;
  phone_country_code: string | null;
  email: string | null;
  languages: string[] | null;
  status: PartnerFleetStatus;
  deleted_at: Date | null;
  updated_at: Date;
  uetds_company_id: string | null;
  uetds_company_short_name: string | null;
};

type VehicleRow = {
  id: string;
  partner_id: string;
  plate: string;
  brand_code: string | null;
  model_code: string | null;
  brand: string | null;
  model: string | null;
  model_year: number | null;
  color_code: string | null;
  color_other: string | null;
  color: string | null;
  passenger_capacity: number | null;
  luggage_capacity: number | null;
  vehicle_class_code: string | null;
  feature_codes: string[] | null;
  feature_other: string | null;
  features: string | null;
  status: PartnerVehicleStatus;
  approved_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  uetds_company_id: string | null;
  uetds_company_short_name: string | null;
};

function mapDriver(row: DriverRow): PartnerDriverRecord {
  return {
    id: row.id,
    partnerId: row.partner_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: partnerDriverFullName(row.first_name, row.last_name),
    nationalId: row.national_id,
    phone: row.phone,
    phoneCountryCode: row.phone_country_code,
    email: row.email,
    languageCodes: normalizePartnerDriverLanguageCodes(row.languages ?? []),
    status: row.status,
    deletedAt: row.deleted_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
    ...mapUetdsCompanyLink(row.uetds_company_id, row.uetds_company_short_name),
  };
}

function mapVehicle(row: VehicleRow): PartnerVehicleRecord {
  return {
    id: row.id,
    partnerId: row.partner_id,
    plate: row.plate,
    brandCode: row.brand_code,
    modelCode: row.model_code,
    brand: row.brand,
    model: row.model,
    modelYear: row.model_year,
    colorCode: row.color_code,
    colorOther: row.color_other,
    color: row.color,
    passengerCapacity: row.passenger_capacity,
    luggageCapacity: row.luggage_capacity,
    vehicleClassCode: row.vehicle_class_code,
    featureCodes: row.feature_codes ?? [],
    featureOther: row.feature_other,
    features: row.features,
    status: row.status,
    approvedAt: row.approved_at?.toISOString() ?? null,
    deletedAt: row.deleted_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...mapUetdsCompanyLink(row.uetds_company_id, row.uetds_company_short_name),
  };
}

const DRIVER_SELECT = `
  d.id, d.partner_id, d.first_name, d.last_name, d.national_id, d.phone, d.phone_country_code,
  d.email, d.languages, d.status, d.deleted_at, d.updated_at, d.uetds_company_id,
  uc.short_name AS uetds_company_short_name
`;

const VEHICLE_SELECT = `
  v.id, v.partner_id, v.plate, v.brand_code, v.model_code, v.brand, v.model, v.model_year,
  v.color_code, v.color_other, v.color, v.passenger_capacity, v.luggage_capacity,
  v.vehicle_class_code, v.feature_codes, v.feature_other, v.features, v.status,
  v.approved_at, v.deleted_at, v.created_at, v.updated_at, v.uetds_company_id,
  uc.short_name AS uetds_company_short_name
`;

const DRIVER_FROM = `
  FROM partner_drivers d
  LEFT JOIN uetds_companies uc ON uc.id = d.uetds_company_id
`;

const VEHICLE_FROM = `
  FROM partner_vehicles v
  LEFT JOIN uetds_companies uc ON uc.id = v.uetds_company_id
`;

export async function listPartnerDrivers(
  partnerId: string,
): Promise<PartnerDriverRecord[]> {
  const result = await query<DriverRow>(
    `SELECT ${DRIVER_SELECT}
     ${DRIVER_FROM}
     WHERE d.partner_id = $1
       AND d.deleted_at IS NULL
     ORDER BY d.last_name ASC, d.first_name ASC, d.created_at ASC`,
    [partnerId],
  );
  return result.rows.map(mapDriver);
}

export async function listPartnerVehicles(
  partnerId: string,
): Promise<PartnerVehicleRecord[]> {
  const result = await query<VehicleRow>(
    `SELECT ${VEHICLE_SELECT}
     ${VEHICLE_FROM}
     WHERE v.partner_id = $1
       AND v.deleted_at IS NULL
     ORDER BY v.created_at DESC, v.id DESC`,
    [partnerId],
  );
  return result.rows.map(mapVehicle);
}

export async function listAssignablePartnerDrivers(
  partnerId: string,
): Promise<PartnerDriverRecord[]> {
  return (await listPartnerDrivers(partnerId)).filter(isPartnerFleetAssignable);
}

export async function listAssignablePartnerVehicles(
  partnerId: string,
): Promise<PartnerVehicleRecord[]> {
  return (await listPartnerVehicles(partnerId)).filter(isPartnerFleetAssignable);
}

export async function getPartnerDriver(
  partnerId: string,
  driverId: string,
): Promise<PartnerDriverRecord | null> {
  const result = await query<DriverRow>(
    `SELECT ${DRIVER_SELECT}
     ${DRIVER_FROM}
     WHERE d.id = $1
       AND d.partner_id = $2
       AND d.deleted_at IS NULL
     LIMIT 1`,
    [driverId, partnerId],
  );
  return result.rows[0] ? mapDriver(result.rows[0]) : null;
}

export async function getPartnerVehicle(
  partnerId: string,
  vehicleId: string,
): Promise<PartnerVehicleRecord | null> {
  const result = await query<VehicleRow>(
    `SELECT ${VEHICLE_SELECT}
     ${VEHICLE_FROM}
     WHERE v.id = $1
       AND v.partner_id = $2
       AND v.deleted_at IS NULL
     LIMIT 1`,
    [vehicleId, partnerId],
  );
  return result.rows[0] ? mapVehicle(result.rows[0]) : null;
}

function editorColumns(editor: PartnerFleetEditor) {
  if (editor.source === "ops") {
    return {
      lastEditedByOpsUserId: editor.userId,
      lastEditedByPartnerUserId: null as string | null,
      deletedByOpsUserId: editor.userId,
      deletedByPartnerUserId: null as string | null,
    };
  }
  return {
    lastEditedByOpsUserId: null as string | null,
    lastEditedByPartnerUserId: editor.userId,
    deletedByOpsUserId: null as string | null,
    deletedByPartnerUserId: editor.userId,
  };
}

function uniquePartnerDriverConflict(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "23505") {
    return null;
  }
  const constraint = "constraint" in error ? String(error.constraint) : "";
  if (constraint.includes("email")) {
    return "duplicate-email" as const;
  }
  return "duplicate-national-id" as const;
}

function parseDriverEmail(value: string | undefined) {
  if (value == null) {
    return { ok: true as const, email: undefined };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true as const, email: null };
  }
  const email = normalizePartnerEmail(trimmed);
  if (!isValidEmail(email) || email.length < 3 || email.length > 254) {
    return { ok: false as const, error: "invalid-email" as const };
  }
  return { ok: true as const, email };
}

function parseDriverInput(input: {
  fullName: string;
  existingFirst: string;
  existingLast: string;
  phoneCountryCode: string;
  phoneNational: string;
  nationalId: string;
  languageCodes: readonly string[];
  email?: string;
}) {
  const names = parseDriverName(input.fullName, input.existingFirst, input.existingLast);
  if (
    !names.firstName ||
    !names.lastName ||
    names.firstName.length > PARTNER_CONTACT_NAME_MAX_LENGTH ||
    names.lastName.length > PARTNER_CONTACT_NAME_MAX_LENGTH
  ) {
    return { ok: false as const, error: "invalid-name" as const };
  }
  const nationalId = normalizeDriverNationalId(input.nationalId);
  if (!isDriverNationalIdValid(nationalId)) {
    return { ok: false as const, error: "invalid-national-id" as const };
  }
  const phoneCountryCode = normalizeIso2(input.phoneCountryCode);
  if (!phoneCountryCode || phoneValidity(phoneCountryCode, input.phoneNational) !== "valid") {
    return { ok: false as const, error: "invalid-phone" as const };
  }
  const phone = toE164(phoneCountryCode, input.phoneNational);
  if (!phone) {
    return { ok: false as const, error: "invalid-phone" as const };
  }
  const languageCodes = normalizePartnerDriverLanguageCodes(input.languageCodes);
  if (languageCodes.length === 0) {
    return { ok: false as const, error: "invalid-languages" as const };
  }
  const email = parseDriverEmail(input.email);
  if (!email.ok) {
    return email;
  }
  return {
    ok: true as const,
    value: {
      firstName: names.firstName,
      lastName: names.lastName,
      nationalId,
      phone,
      phoneCountryCode,
      languageCodes,
      email: email.email,
    },
  };
}

function parseDriverName(fullName: string, existingFirst: string, existingLast: string) {
  const submitted = fullName.trim().replace(/\s+/g, " ");
  const existingJoined = joinPartnerContactName(existingFirst, existingLast);
  if (submitted && existingJoined && submitted === existingJoined) {
    return { firstName: existingFirst, lastName: existingLast };
  }
  const split = splitPartnerContactName(submitted);
  if (split) {
    return {
      firstName: split.contactFirstName,
      lastName: split.contactLastName,
    };
  }
  if (submitted) {
    return { firstName: submitted, lastName: "" };
  }
  return { firstName: existingFirst, lastName: existingLast };
}

export async function createPartnerDriver(input: {
  partnerId: string;
  editor: PartnerFleetEditor;
  fullName: string;
  phoneCountryCode: string;
  phoneNational: string;
  nationalId: string;
  languageCodes: readonly string[];
  email?: string;
  uetdsCompanyId: string | null;
}) {
  const parsed = parseDriverInput({
    fullName: input.fullName,
    existingFirst: "",
    existingLast: "",
    phoneCountryCode: input.phoneCountryCode,
    phoneNational: input.phoneNational,
    nationalId: input.nationalId,
    languageCodes: input.languageCodes,
    email: input.email ?? "",
  });
  if (!parsed.ok) {
    return parsed;
  }
  const edited = editorColumns(input.editor);
  try {
    const created = await query<{ id: string }>(
      `INSERT INTO partner_drivers (
          partner_id, first_name, last_name, national_id, phone, phone_country_code,
          email, languages, status, last_edited_by_ops_user_id, last_edited_by_partner_user_id,
          uetds_company_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11)
       RETURNING id`,
      [
        input.partnerId,
        parsed.value.firstName,
        parsed.value.lastName,
        parsed.value.nationalId,
        parsed.value.phone,
        parsed.value.phoneCountryCode,
        parsed.value.email ?? null,
        parsed.value.languageCodes,
        edited.lastEditedByOpsUserId,
        edited.lastEditedByPartnerUserId,
        input.uetdsCompanyId,
      ],
    );
    const id = created.rows[0]?.id;
    if (!id) {
      return { ok: false as const, error: "failed" as const };
    }
    return { ok: true as const, driverId: id };
  } catch (error) {
    const conflict = uniquePartnerDriverConflict(error);
    if (conflict) {
      return { ok: false as const, error: conflict };
    }
    throw error;
  }
}

export async function updatePartnerDriver(input: {
  partnerId: string;
  driverId: string;
  editor: PartnerFleetEditor;
  fullName: string;
  phoneCountryCode: string;
  phoneNational: string;
  nationalId: string;
  languageCodes: readonly string[];
  email?: string;
  uetdsCompanyId: string | null;
}) {
  const current = await getPartnerDriver(input.partnerId, input.driverId);
  if (!current) {
    return { ok: false as const, error: "not-found" as const };
  }
  const parsed = parseDriverInput({
    fullName: input.fullName,
    existingFirst: current.firstName,
    existingLast: current.lastName,
    phoneCountryCode: input.phoneCountryCode,
    phoneNational: input.phoneNational,
    nationalId: input.nationalId,
    languageCodes: input.languageCodes,
    email: input.email,
  });
  if (!parsed.ok) {
    return parsed;
  }
  const nextEmail = parsed.value.email === undefined ? current.email : parsed.value.email;
  const edited = editorColumns(input.editor);
  try {
    const updated = await query(
      `UPDATE partner_drivers
       SET first_name = $3,
           last_name = $4,
           national_id = $5,
           phone = $6,
           phone_country_code = $7,
           email = $8,
           languages = $9,
           uetds_company_id = $10,
           last_edited_by_ops_user_id = COALESCE($11, last_edited_by_ops_user_id),
           last_edited_by_partner_user_id = COALESCE($12, last_edited_by_partner_user_id)
       WHERE id = $1
         AND partner_id = $2
         AND deleted_at IS NULL`,
      [
        input.driverId,
        input.partnerId,
        parsed.value.firstName,
        parsed.value.lastName,
        parsed.value.nationalId,
        parsed.value.phone,
        parsed.value.phoneCountryCode,
        nextEmail,
        parsed.value.languageCodes,
        input.uetdsCompanyId,
        edited.lastEditedByOpsUserId,
        edited.lastEditedByPartnerUserId,
      ],
    );
    if (updated.rowCount !== 1) {
      return { ok: false as const, error: "failed" as const };
    }
    return { ok: true as const };
  } catch (error) {
    const conflict = uniquePartnerDriverConflict(error);
    if (conflict) {
      return { ok: false as const, error: conflict };
    }
    throw error;
  }
}

function displayVehicleColor(colorCode: string, colorOther: string | null) {
  if (colorCode === "other") {
    return colorOther;
  }
  return colorCode;
}

function displayVehicleFeatures(featureCodes: string[], featureOther: string | null) {
  const labels = featureCodes.map((code) => (code === "other" ? featureOther : code)).filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : null;
}

type PartnerVehicleWriteInput = {
  plate: string;
  brandCode: string;
  modelCode: string;
  modelYear: string | number;
  colorCode: string;
  colorOther: string;
  passengerCapacity: string | number;
  luggageCapacity: string | number;
  vehicleClassCode: string;
  featureCodes: readonly string[];
  featureOther: string;
};

export async function createPartnerVehicle(
  input: PartnerVehicleWriteInput & {
    partnerId: string;
    editor: PartnerFleetEditor;
    uetdsCompanyId: string | null;
  },
) {
  const parsed = parsePartnerVehicleInput(input);
  if (!parsed.ok) {
    return parsed;
  }
  const edited = editorColumns(input.editor);
  const status = partnerCreateVehicleStatus(parsed.value.vehicleClassCode);
  try {
    const created = await query<{ id: string }>(
      `INSERT INTO partner_vehicles (
          partner_id, plate, brand_code, model_code, brand, model, model_year,
          color_code, color_other, color, passenger_capacity, luggage_capacity,
          vehicle_class_code, feature_codes, feature_other, features, status,
          last_edited_by_ops_user_id, last_edited_by_partner_user_id, uetds_company_id
       )
       VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
       )
       RETURNING id`,
      [
        input.partnerId,
        parsed.value.plate,
        parsed.value.brandCode,
        parsed.value.modelCode,
        parsed.value.brand,
        parsed.value.model,
        parsed.value.modelYear,
        parsed.value.colorCode,
        parsed.value.colorOther,
        displayVehicleColor(parsed.value.colorCode, parsed.value.colorOther),
        parsed.value.passengerCapacity,
        parsed.value.luggageCapacity,
        parsed.value.vehicleClassCode,
        parsed.value.featureCodes,
        parsed.value.featureOther,
        displayVehicleFeatures(parsed.value.featureCodes, parsed.value.featureOther),
        status,
        edited.lastEditedByOpsUserId,
        edited.lastEditedByPartnerUserId,
        input.uetdsCompanyId,
      ],
    );
    const id = created.rows[0]?.id;
    if (!id) {
      return { ok: false as const, error: "failed" as const };
    }
    return { ok: true as const, vehicleId: id, status, needsApproval: status === "pending_approval" };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { ok: false as const, error: "duplicate-plate" as const };
    }
    throw error;
  }
}

export async function updatePartnerVehicle(
  input: PartnerVehicleWriteInput & {
    partnerId: string;
    vehicleId: string;
    editor: PartnerFleetEditor;
    uetdsCompanyId: string | null;
  },
) {
  const current = await getPartnerVehicle(input.partnerId, input.vehicleId);
  if (!current) {
    return { ok: false as const, error: "not-found" as const };
  }
  const parsed = parsePartnerVehicleInput(input);
  if (!parsed.ok) {
    return parsed;
  }
  const edited = editorColumns(input.editor);
  const status = nextPartnerVehicleStatus({
    nextClassCode: parsed.value.vehicleClassCode,
    currentStatus: current.status,
    currentClassCode: current.vehicleClassCode,
    source: input.editor.source,
  });
  const classChangedToApproval =
    vehicleClassRequiresApproval(parsed.value.vehicleClassCode) &&
    current.vehicleClassCode !== parsed.value.vehicleClassCode;
  try {
    const updated = await query(
      `UPDATE partner_vehicles
       SET plate = $3,
           brand_code = $4,
           model_code = $5,
           brand = $6,
           model = $7,
           model_year = $8,
           color_code = $9,
           color_other = $10,
           color = $11,
           passenger_capacity = $12,
           luggage_capacity = $13,
           vehicle_class_code = $14,
           feature_codes = $15,
           feature_other = $16,
           features = $17,
           status = $18,
           approved_at = CASE WHEN $19 THEN NULL ELSE approved_at END,
           approved_by_ops_user_id = CASE WHEN $19 THEN NULL ELSE approved_by_ops_user_id END,
           last_edited_by_ops_user_id = COALESCE($20, last_edited_by_ops_user_id),
           last_edited_by_partner_user_id = COALESCE($21, last_edited_by_partner_user_id),
           uetds_company_id = $22
       WHERE id = $1
         AND partner_id = $2
         AND deleted_at IS NULL`,
      [
        input.vehicleId,
        input.partnerId,
        parsed.value.plate,
        parsed.value.brandCode,
        parsed.value.modelCode,
        parsed.value.brand,
        parsed.value.model,
        parsed.value.modelYear,
        parsed.value.colorCode,
        parsed.value.colorOther,
        displayVehicleColor(parsed.value.colorCode, parsed.value.colorOther),
        parsed.value.passengerCapacity,
        parsed.value.luggageCapacity,
        parsed.value.vehicleClassCode,
        parsed.value.featureCodes,
        parsed.value.featureOther,
        displayVehicleFeatures(parsed.value.featureCodes, parsed.value.featureOther),
        status,
        classChangedToApproval && input.editor.source === "partner",
        edited.lastEditedByOpsUserId,
        edited.lastEditedByPartnerUserId,
        input.uetdsCompanyId,
      ],
    );
    void updated;
    return {
      ok: true as const,
      status,
      needsApproval: status === "pending_approval" && current.status !== "pending_approval",
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { ok: false as const, error: "duplicate-plate" as const };
    }
    throw error;
  }
}

async function setDriverStatus(input: {
  partnerId: string;
  driverId: string;
  editor: PartnerFleetEditor;
  fromStatus: PartnerFleetStatus;
  toStatus: PartnerFleetStatus;
}) {
  const edited = editorColumns(input.editor);
  const updated = await query<{ id: string }>(
    `UPDATE partner_drivers
     SET status = $4,
         last_edited_by_ops_user_id = COALESCE($5, last_edited_by_ops_user_id),
         last_edited_by_partner_user_id = COALESCE($6, last_edited_by_partner_user_id)
     WHERE id = $1
       AND partner_id = $2
       AND deleted_at IS NULL
       AND status = $3
     RETURNING id`,
    [
      input.driverId,
      input.partnerId,
      input.fromStatus,
      input.toStatus,
      edited.lastEditedByOpsUserId,
      edited.lastEditedByPartnerUserId,
    ],
  );
  if (!updated.rows[0]) {
    return { ok: false as const, error: "not-found" as const };
  }
  return { ok: true as const };
}

export async function activatePartnerDriver(input: {
  partnerId: string;
  driverId: string;
  editor: PartnerFleetEditor;
}) {
  return setDriverStatus({
    partnerId: input.partnerId,
    driverId: input.driverId,
    editor: input.editor,
    fromStatus: "inactive",
    toStatus: "active",
  });
}

export async function deactivatePartnerDriver(input: {
  partnerId: string;
  driverId: string;
  editor: PartnerFleetEditor;
}) {
  return setDriverStatus({
    partnerId: input.partnerId,
    driverId: input.driverId,
    editor: input.editor,
    fromStatus: "active",
    toStatus: "inactive",
  });
}

async function setVehicleStatus(input: {
  partnerId: string;
  vehicleId: string;
  editor: PartnerFleetEditor;
  fromStatus: PartnerVehicleStatus | PartnerVehicleStatus[];
  toStatus: PartnerVehicleStatus;
  approve?: boolean;
  reject?: boolean;
}) {
  const current = await getPartnerVehicle(input.partnerId, input.vehicleId);
  if (!current) {
    return { ok: false as const, error: "not-found" as const };
  }
  const allowed = Array.isArray(input.fromStatus) ? input.fromStatus : [input.fromStatus];
  if (!allowed.includes(current.status)) {
    return { ok: false as const, error: "not-found" as const };
  }
  if (
    input.editor.source === "partner" &&
    input.toStatus === "active" &&
    vehicleClassRequiresApproval(current.vehicleClassCode ?? "") &&
    !current.approvedAt
  ) {
    return { ok: false as const, error: "needs-approval" as const };
  }
  const edited = editorColumns(input.editor);
  const updated = await query<{ id: string }>(
    `UPDATE partner_vehicles
     SET status = $4,
         approved_at = CASE WHEN $5 THEN NOW() ELSE approved_at END,
         approved_by_ops_user_id = CASE WHEN $5 THEN $6 ELSE approved_by_ops_user_id END,
         rejected_at = CASE WHEN $7 THEN NOW() WHEN $5 THEN NULL ELSE rejected_at END,
         rejected_by_ops_user_id = CASE WHEN $7 THEN $6 WHEN $5 THEN NULL ELSE rejected_by_ops_user_id END,
         last_edited_by_ops_user_id = COALESCE($8, last_edited_by_ops_user_id),
         last_edited_by_partner_user_id = COALESCE($9, last_edited_by_partner_user_id)
     WHERE id = $1
       AND partner_id = $2
       AND deleted_at IS NULL
       AND status = $3
     RETURNING id`,
    [
      input.vehicleId,
      input.partnerId,
      current.status,
      input.toStatus,
      Boolean(input.approve),
      edited.lastEditedByOpsUserId,
      Boolean(input.reject),
      edited.lastEditedByOpsUserId,
      edited.lastEditedByPartnerUserId,
    ],
  );
  if (!updated.rows[0]) {
    return { ok: false as const, error: "not-found" as const };
  }
  return { ok: true as const };
}

export async function activatePartnerVehicle(input: {
  partnerId: string;
  vehicleId: string;
  editor: PartnerFleetEditor;
}) {
  return setVehicleStatus({
    partnerId: input.partnerId,
    vehicleId: input.vehicleId,
    editor: input.editor,
    fromStatus: "inactive",
    toStatus: "active",
  });
}

export async function deactivatePartnerVehicle(input: {
  partnerId: string;
  vehicleId: string;
  editor: PartnerFleetEditor;
}) {
  return setVehicleStatus({
    partnerId: input.partnerId,
    vehicleId: input.vehicleId,
    editor: input.editor,
    fromStatus: "active",
    toStatus: "inactive",
  });
}

export async function approvePartnerVehicle(input: {
  partnerId: string;
  vehicleId: string;
  editor: Extract<PartnerFleetEditor, { source: "ops" }>;
}) {
  return setVehicleStatus({
    partnerId: input.partnerId,
    vehicleId: input.vehicleId,
    editor: input.editor,
    fromStatus: ["pending_approval", "rejected"],
    toStatus: "active",
    approve: true,
  });
}

export async function rejectPartnerVehicle(input: {
  partnerId: string;
  vehicleId: string;
  editor: Extract<PartnerFleetEditor, { source: "ops" }>;
}) {
  return setVehicleStatus({
    partnerId: input.partnerId,
    vehicleId: input.vehicleId,
    editor: input.editor,
    fromStatus: ["pending_approval", "active"],
    toStatus: "rejected",
    reject: true,
  });
}

export async function fleetRecordHasAssignments(input: {
  kind: "driver" | "vehicle";
  recordId: string;
}) {
  const column =
    input.kind === "driver" ? "assigned_driver_id" : "assigned_vehicle_id";
  const result = await query<{ id: string }>(
    `SELECT id
     FROM reservations
     WHERE ${column} = $1
       AND deleted_at IS NULL
       AND status <> 'cancelled'
     LIMIT 1`,
    [input.recordId],
  );
  return Boolean(result.rows[0]);
}

export async function deletePartnerDriver(input: {
  partnerId: string;
  driverId: string;
  editor: PartnerFleetEditor;
}) {
  if (await fleetRecordHasAssignments({ kind: "driver", recordId: input.driverId })) {
    return { ok: false as const, error: "in-use" as const };
  }
  const edited = editorColumns(input.editor);
  const updated = await query<{ id: string }>(
    `UPDATE partner_drivers
     SET status = 'inactive',
         deleted_at = NOW(),
         deleted_by_ops_user_id = COALESCE($3, deleted_by_ops_user_id),
         deleted_by_partner_user_id = COALESCE($4, deleted_by_partner_user_id),
         last_edited_by_ops_user_id = COALESCE($3, last_edited_by_ops_user_id),
         last_edited_by_partner_user_id = COALESCE($4, last_edited_by_partner_user_id)
     WHERE id = $1
       AND partner_id = $2
       AND deleted_at IS NULL
     RETURNING id`,
    [
      input.driverId,
      input.partnerId,
      edited.deletedByOpsUserId,
      edited.deletedByPartnerUserId,
    ],
  );
  if (!updated.rows[0]) {
    return { ok: false as const, error: "not-found" as const };
  }
  return { ok: true as const };
}

export async function deletePartnerVehicle(input: {
  partnerId: string;
  vehicleId: string;
  editor: PartnerFleetEditor;
}) {
  if (await fleetRecordHasAssignments({ kind: "vehicle", recordId: input.vehicleId })) {
    return { ok: false as const, error: "in-use" as const };
  }
  const edited = editorColumns(input.editor);
  const updated = await query<{ id: string }>(
    `UPDATE partner_vehicles
     SET status = 'inactive',
         deleted_at = NOW(),
         deleted_by_ops_user_id = COALESCE($3, deleted_by_ops_user_id),
         deleted_by_partner_user_id = COALESCE($4, deleted_by_partner_user_id),
         last_edited_by_ops_user_id = COALESCE($3, last_edited_by_ops_user_id),
         last_edited_by_partner_user_id = COALESCE($4, last_edited_by_partner_user_id)
     WHERE id = $1
       AND partner_id = $2
       AND deleted_at IS NULL
     RETURNING id`,
    [
      input.vehicleId,
      input.partnerId,
      edited.deletedByOpsUserId,
      edited.deletedByPartnerUserId,
    ],
  );
  if (!updated.rows[0]) {
    return { ok: false as const, error: "not-found" as const };
  }
  return { ok: true as const };
}

