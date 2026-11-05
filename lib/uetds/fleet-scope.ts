import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { mapUetdsCompanyReadiness } from "@/lib/uetds/eligibility";
import {
  uetdsDriverOptionLabel,
  uetdsVehicleOptionLabel,
  type UetdsFleetOption,
  type UetdsFleetScope,
} from "@/lib/uetds/fleet-options";

type DriverRow = {
  id: string;
  partner_id: string;
  partner_name: string;
  first_name: string;
  last_name: string;
  national_id: string | null;
  uetds_company_id: string | null;
  company_short_name: string | null;
  company_status: string | null;
  company_integration_status: string | null;
  service_advanced_enabled: boolean | null;
  linked_vehicle_ids: string[] | null;
  default_vehicle_id: string | null;
  default_authority_id: string | null;
};

type VehicleRow = {
  id: string;
  partner_id: string;
  partner_name: string;
  plate: string;
  brand: string | null;
  model: string | null;
  uetds_company_id: string | null;
  company_short_name: string | null;
  company_status: string | null;
  company_integration_status: string | null;
};

function mapCompany(row: {
  uetds_company_id: string | null;
  company_short_name: string | null;
  company_status: string | null;
  company_integration_status: string | null;
}) {
  return mapUetdsCompanyReadiness({
    id: row.uetds_company_id,
    shortName: row.company_short_name,
    status: row.company_status,
    integrationStatus: row.company_integration_status,
  });
}

function mapDriver(row: DriverRow, scope: UetdsFleetScope): UetdsFleetOption {
  const company = mapCompany(row);
  return {
    id: row.id,
    partnerId: row.partner_id,
    uetdsCompanyId: row.uetds_company_id,
    company,
    hasNationalId: Boolean(row.national_id?.trim()),
    membershipStatus: row.service_advanced_enabled ? "gold" : "standard",
    vehicleIds: row.linked_vehicle_ids ?? (row.default_vehicle_id ? [row.default_vehicle_id] : []),
    defaultVehicleId:
      row.linked_vehicle_ids?.length === 1
        ? row.linked_vehicle_ids[0]
        : row.linked_vehicle_ids
          ? null
          : row.default_vehicle_id,
    defaultAuthorityId: row.default_authority_id,
    label: uetdsDriverOptionLabel({
      firstName: row.first_name,
      lastName: row.last_name,
      companyShortName: company?.shortName,
      partnerName: scope === "ops" ? row.partner_name : null,
    }),
  };
}

function mapVehicle(row: VehicleRow, scope: UetdsFleetScope): UetdsFleetOption {
  const company = mapCompany(row);
  return {
    id: row.id,
    partnerId: row.partner_id,
    uetdsCompanyId: row.uetds_company_id,
    company,
    label: uetdsVehicleOptionLabel({
      plate: row.plate,
      brand: row.brand,
      model: row.model,
      companyShortName: company?.shortName,
      partnerName: scope === "ops" ? row.partner_name : null,
    }),
  };
}

function driverSelect(partnerParam: "$1" | "$2") {
  return `
  d.id,
  CASE WHEN ${partnerParam}::uuid IS NULL THEN d.partner_id ELSE ${partnerParam}::uuid END AS partner_id,
  d.first_name, d.last_name, d.national_id,
  CASE
    WHEN ${partnerParam}::uuid IS NULL THEN d.uetds_company_id
    WHEN access.partner_id IS NOT NULL THEN access.uetds_company_id
    WHEN d.partner_id = ${partnerParam}::uuid THEN d.uetds_company_id
    ELSE NULL
  END AS uetds_company_id,
  p.name AS partner_name,
  uc.short_name AS company_short_name,
  uc.status AS company_status,
  uc.integration_status AS company_integration_status,
  d.service_advanced_enabled,
  links.vehicle_ids AS linked_vehicle_ids,
  CASE
    WHEN ea.id IS NULL THEN NULL
    WHEN (CASE
      WHEN ${partnerParam}::uuid IS NULL THEN d.uetds_company_id
      WHEN access.partner_id IS NOT NULL THEN access.uetds_company_id
      WHEN d.partner_id = ${partnerParam}::uuid THEN d.uetds_company_id
      ELSE NULL
    END) IS NOT NULL
      AND NOT EXISTS (
      SELECT 1 FROM partner_uetds_authority_companies ac
      WHERE ac.authority_id = ea.id
        AND ac.company_id = (CASE
          WHEN ${partnerParam}::uuid IS NULL THEN d.uetds_company_id
          WHEN access.partner_id IS NOT NULL THEN access.uetds_company_id
          WHEN d.partner_id = ${partnerParam}::uuid THEN d.uetds_company_id
          ELSE NULL
        END)
    ) THEN NULL
    ELSE ea.id
  END AS default_authority_id
`;
}

function driverJoins(partnerParam: "$1" | "$2") {
  return `
  LEFT JOIN LATERAL (
    SELECT access.partner_id, access.uetds_company_id
      FROM partner_fleet_defaults fd
      JOIN partner_vehicles dv
        ON dv.id = fd.vehicle_id
       AND dv.deleted_at IS NULL
       AND dv.status = 'active'
      JOIN partner_vehicle_access access
        ON access.vehicle_id = dv.id
       AND access.partner_id = ${partnerParam}::uuid
     WHERE fd.driver_id = d.id
     ORDER BY fd.created_at, dv.id
     LIMIT 1
  ) access ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(array_agg(v.id ORDER BY fd.created_at, v.plate), '{}') AS vehicle_ids
      FROM partner_fleet_defaults fd
      JOIN partner_vehicles v
        ON v.id = fd.vehicle_id
       AND v.deleted_at IS NULL
       AND v.status = 'active'
     WHERE fd.driver_id = d.id
       AND (${partnerParam}::uuid IS NULL OR partner_can_access_vehicle(${partnerParam}::uuid, v.id))
  ) links ON TRUE
  LEFT JOIN partner_uetds_authorities ea
    ON ea.id = d.default_edevlet_authority_id
   AND ea.partner_id = CASE WHEN ${partnerParam}::uuid IS NULL THEN d.partner_id ELSE ${partnerParam}::uuid END
   AND ea.deleted_at IS NULL
   AND ea.status = 'active'
`;
}

function vehicleSelect(partnerParam: "$1" | "$2") {
  return `
  v.id,
  CASE WHEN ${partnerParam}::uuid IS NULL THEN v.partner_id ELSE ${partnerParam}::uuid END AS partner_id,
  v.plate, v.brand, v.model,
  CASE WHEN ${partnerParam}::uuid IS NULL THEN v.uetds_company_id ELSE access.uetds_company_id END AS uetds_company_id,
  p.name AS partner_name,
  uc.short_name AS company_short_name,
  uc.status AS company_status,
  uc.integration_status AS company_integration_status
`;
}

export async function listUetdsDriverOptions(input: {
  scope: UetdsFleetScope;
  partnerId?: string | null;
}): Promise<UetdsFleetOption[]> {
  if (input.scope === "partner" && !isUuid(input.partnerId ?? "")) {
    return [];
  }
  const result = await query<DriverRow>(
    `SELECT ${driverSelect("$1")}
     FROM partner_drivers d
     JOIN partners p ON p.id = d.partner_id AND p.deleted_at IS NULL
     ${driverJoins("$1")}
     LEFT JOIN uetds_companies uc
       ON uc.id = CASE
         WHEN $1::uuid IS NULL THEN d.uetds_company_id
         WHEN access.partner_id IS NOT NULL THEN access.uetds_company_id
         WHEN d.partner_id = $1 THEN d.uetds_company_id
         ELSE NULL
       END
     WHERE d.deleted_at IS NULL
       AND d.status = 'active'
       AND ($1::uuid IS NULL OR partner_can_access_driver($1, d.id))
     ORDER BY d.first_name ASC, d.last_name ASC, d.id ASC`,
    [input.scope === "partner" ? input.partnerId : null],
  );
  return result.rows.map((row) => mapDriver(row, input.scope));
}

export async function listUetdsVehicleOptions(input: {
  scope: UetdsFleetScope;
  partnerId?: string | null;
}): Promise<UetdsFleetOption[]> {
  if (input.scope === "partner" && !isUuid(input.partnerId ?? "")) {
    return [];
  }
  const result = await query<VehicleRow>(
    `SELECT ${vehicleSelect("$1")}
     FROM partner_vehicles v
     JOIN partners p ON p.id = v.partner_id AND p.deleted_at IS NULL
     LEFT JOIN partner_vehicle_access access
       ON access.vehicle_id = v.id AND access.partner_id = $1
     LEFT JOIN uetds_companies uc
       ON uc.id = CASE WHEN $1::uuid IS NULL THEN v.uetds_company_id ELSE access.uetds_company_id END
     WHERE v.deleted_at IS NULL
       AND v.status = 'active'
       AND ($1::uuid IS NULL OR partner_can_access_vehicle($1, v.id))
     ORDER BY v.plate ASC, v.id ASC`,
    [input.scope === "partner" ? input.partnerId : null],
  );
  return result.rows.map((row) => mapVehicle(row, input.scope));
}

export async function getUetdsDriverOption(input: {
  scope: UetdsFleetScope;
  partnerId?: string | null;
  driverId: string;
}): Promise<(UetdsFleetOption & { fullName: string; nationalId: string | null }) | null> {
  if (!isUuid(input.driverId) || (input.scope === "partner" && !isUuid(input.partnerId ?? ""))) {
    return null;
  }
  const result = await query<DriverRow>(
    `SELECT ${driverSelect("$2")}
     FROM partner_drivers d
     JOIN partners p ON p.id = d.partner_id AND p.deleted_at IS NULL
     ${driverJoins("$2")}
     LEFT JOIN uetds_companies uc
       ON uc.id = CASE
         WHEN $2::uuid IS NULL THEN d.uetds_company_id
         WHEN access.partner_id IS NOT NULL THEN access.uetds_company_id
         WHEN d.partner_id = $2 THEN d.uetds_company_id
         ELSE NULL
       END
     WHERE d.id = $1
       AND d.deleted_at IS NULL
       AND d.status = 'active'
       AND ($2::uuid IS NULL OR partner_can_access_driver($2, d.id))
     LIMIT 1`,
    [input.driverId, input.scope === "partner" ? input.partnerId : null],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    ...mapDriver(row, input.scope),
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    nationalId: row.national_id,
  };
}

export async function withSelectedUetdsOptions(input: {
  scope: UetdsFleetScope;
  partnerId?: string | null;
  driverId: string;
  vehicleId: string;
  drivers: UetdsFleetOption[];
  vehicles: UetdsFleetOption[];
}) {
  const [driver, vehicle] = await Promise.all([
    input.driverId && !input.drivers.some((item) => item.id === input.driverId)
      ? getUetdsDriverOption({
          scope: input.scope,
          partnerId: input.partnerId,
          driverId: input.driverId,
        })
      : null,
    input.vehicleId && !input.vehicles.some((item) => item.id === input.vehicleId)
      ? getUetdsVehicleOption({
          scope: input.scope,
          partnerId: input.partnerId,
          vehicleId: input.vehicleId,
        })
      : null,
  ]);
  return {
    drivers: driver ? [driver, ...input.drivers] : input.drivers,
    vehicles: vehicle ? [vehicle, ...input.vehicles] : input.vehicles,
  };
}

export async function getUetdsVehicleOption(input: {
  scope: UetdsFleetScope;
  partnerId?: string | null;
  vehicleId: string;
}): Promise<(UetdsFleetOption & { plate: string; brand: string | null; model: string | null }) | null> {
  if (!isUuid(input.vehicleId) || (input.scope === "partner" && !isUuid(input.partnerId ?? ""))) {
    return null;
  }
  const result = await query<VehicleRow>(
    `SELECT ${vehicleSelect("$2")}
     FROM partner_vehicles v
     JOIN partners p ON p.id = v.partner_id AND p.deleted_at IS NULL
     LEFT JOIN partner_vehicle_access access
       ON access.vehicle_id = v.id AND access.partner_id = $2
     LEFT JOIN uetds_companies uc
       ON uc.id = CASE WHEN $2::uuid IS NULL THEN v.uetds_company_id ELSE access.uetds_company_id END
     WHERE v.id = $1
       AND v.deleted_at IS NULL
       AND v.status = 'active'
       AND ($2::uuid IS NULL OR partner_can_access_vehicle($2, v.id))
     LIMIT 1`,
    [input.vehicleId, input.scope === "partner" ? input.partnerId : null],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    ...mapVehicle(row, input.scope),
    plate: row.plate,
    brand: row.brand,
    model: row.model,
  };
}
