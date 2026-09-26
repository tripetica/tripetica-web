import "server-only";

import { query } from "@/lib/db/postgres";
import { foldDriverSearchText } from "@/lib/partner/driver-list-view";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import {
  mapUetdsCompanyLink,
  type PartnerVehicleRecord,
  type PartnerVehicleStatus,
} from "@/lib/partner/fleet-view";

export const OPS_VEHICLES_PAGE_SIZE = 25;

export type OpsVehicleListItem = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  passengerCapacity: number | null;
  luggageCapacity: number | null;
  vehicleClassCode: string | null;
  status: PartnerVehicleStatus;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  uetdsCompany: UetdsCompanyRef | null;
};

export type OpsVehicleRecord = PartnerVehicleRecord & {
  partnerName: string;
  partnerCode: string;
};

type VehicleListRow = {
  id: string;
  partner_id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  model_year: number | null;
  passenger_capacity: number | null;
  luggage_capacity: number | null;
  vehicle_class_code: string | null;
  status: PartnerVehicleStatus;
  partner_name: string;
  partner_code: string;
  uetds_company_id: string | null;
  uetds_company_short_name: string | null;
};

type VehicleDetailRow = VehicleListRow & {
  brand_code: string | null;
  model_code: string | null;
  color_code: string | null;
  color_other: string | null;
  color: string | null;
  feature_codes: string[] | null;
  feature_other: string | null;
  features: string | null;
  approved_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function foldedSql(expr: string) {
  return `translate(lower(${expr}), 'ıİğĞüÜşŞöÖçÇ', 'iigguussoocc')`;
}

function searchFilters(query: string, values: unknown[]) {
  const q = query.trim();
  if (!q) {
    return;
  }
  values.push(`%${q}%`);
  const like = `$${values.length}`;
  values.push(`%${foldDriverSearchText(q)}%`);
  const folded = `$${values.length}`;
  return `(
    v.plate ILIKE ${like}
    OR ${foldedSql("v.plate")} LIKE ${folded}
    OR COALESCE(v.brand, '') ILIKE ${like}
    OR ${foldedSql("COALESCE(v.brand, '')")} LIKE ${folded}
    OR COALESCE(v.model, '') ILIKE ${like}
    OR ${foldedSql("COALESCE(v.model, '')")} LIKE ${folded}
    OR p.name ILIKE ${like}
    OR ${foldedSql("p.name")} LIKE ${folded}
    OR p.partner_code ILIKE ${like}
  )`;
}

export async function listOpsVehicles(input: {
  query: string;
  page: number;
  pageSize?: number;
}) {
  const pageSize = input.pageSize ?? OPS_VEHICLES_PAGE_SIZE;
  const values: unknown[] = [];
  const filters = ["v.deleted_at IS NULL", "p.deleted_at IS NULL"];
  const search = searchFilters(input.query, values);
  if (search) {
    filters.push(search);
  }
  const where = filters.join(" AND ");
  const count = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM partner_vehicles v
     JOIN partners p ON p.id = v.partner_id
     WHERE ${where}`,
    values,
  );
  const total = Number(count.rows[0]?.count ?? 0);
  const page = Math.max(1, input.page);
  const offset = (page - 1) * pageSize;
  values.push(pageSize, offset);
  const result = await query<VehicleListRow>(
    `SELECT
        v.id,
        v.partner_id,
        v.plate,
        v.brand,
        v.model,
        v.model_year,
        v.passenger_capacity,
        v.luggage_capacity,
        v.vehicle_class_code,
        v.status,
        v.uetds_company_id,
        uc.short_name AS uetds_company_short_name,
        p.name AS partner_name,
        p.partner_code
     FROM partner_vehicles v
     JOIN partners p ON p.id = v.partner_id
     LEFT JOIN uetds_companies uc ON uc.id = v.uetds_company_id
     WHERE ${where}
     ORDER BY v.created_at DESC, v.id DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return {
    items: result.rows.map((row) => ({
      id: row.id,
      plate: row.plate,
      brand: row.brand,
      model: row.model,
      modelYear: row.model_year,
      passengerCapacity: row.passenger_capacity,
      luggageCapacity: row.luggage_capacity,
      vehicleClassCode: row.vehicle_class_code,
      status: row.status,
      partnerId: row.partner_id,
      partnerName: row.partner_name,
      partnerCode: row.partner_code,
      uetdsCompany: mapUetdsCompanyLink(row.uetds_company_id, row.uetds_company_short_name)
        .uetdsCompany,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getOpsVehicle(vehicleId: string): Promise<OpsVehicleRecord | null> {
  const result = await query<VehicleDetailRow>(
    `SELECT
        v.id,
        v.partner_id,
        v.plate,
        v.brand_code,
        v.model_code,
        v.brand,
        v.model,
        v.model_year,
        v.color_code,
        v.color_other,
        v.color,
        v.passenger_capacity,
        v.luggage_capacity,
        v.vehicle_class_code,
        v.feature_codes,
        v.feature_other,
        v.features,
        v.status,
        v.approved_at,
        v.deleted_at,
        v.created_at,
        v.updated_at,
        v.uetds_company_id,
        uc.short_name AS uetds_company_short_name,
        p.name AS partner_name,
        p.partner_code
     FROM partner_vehicles v
     JOIN partners p ON p.id = v.partner_id
     LEFT JOIN uetds_companies uc ON uc.id = v.uetds_company_id
     WHERE v.id = $1
       AND v.deleted_at IS NULL
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [vehicleId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
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
    partnerName: row.partner_name,
    partnerCode: row.partner_code,
    ...mapUetdsCompanyLink(row.uetds_company_id, row.uetds_company_short_name),
  };
}
