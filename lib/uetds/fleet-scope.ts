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

const DRIVER_SELECT = `
  d.id, d.partner_id, d.first_name, d.last_name, d.national_id, d.uetds_company_id,
  p.name AS partner_name,
  uc.short_name AS company_short_name,
  uc.status AS company_status,
  uc.integration_status AS company_integration_status
`;

const VEHICLE_SELECT = `
  v.id, v.partner_id, v.plate, v.brand, v.model, v.uetds_company_id,
  p.name AS partner_name,
  uc.short_name AS company_short_name,
  uc.status AS company_status,
  uc.integration_status AS company_integration_status
`;

export async function listUetdsDriverOptions(input: {
  scope: UetdsFleetScope;
  partnerId?: string | null;
}): Promise<UetdsFleetOption[]> {
  if (input.scope === "partner" && !isUuid(input.partnerId ?? "")) {
    return [];
  }
  const result = await query<DriverRow>(
    `SELECT ${DRIVER_SELECT}
     FROM partner_drivers d
     JOIN partners p ON p.id = d.partner_id AND p.deleted_at IS NULL
     LEFT JOIN uetds_companies uc ON uc.id = d.uetds_company_id
     WHERE d.deleted_at IS NULL
       AND d.status = 'active'
       AND ($1::uuid IS NULL OR d.partner_id = $1)
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
    `SELECT ${VEHICLE_SELECT}
     FROM partner_vehicles v
     JOIN partners p ON p.id = v.partner_id AND p.deleted_at IS NULL
     LEFT JOIN uetds_companies uc ON uc.id = v.uetds_company_id
     WHERE v.deleted_at IS NULL
       AND v.status = 'active'
       AND ($1::uuid IS NULL OR v.partner_id = $1)
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
    `SELECT ${DRIVER_SELECT}
     FROM partner_drivers d
     JOIN partners p ON p.id = d.partner_id AND p.deleted_at IS NULL
     LEFT JOIN uetds_companies uc ON uc.id = d.uetds_company_id
     WHERE d.id = $1
       AND d.deleted_at IS NULL
       AND ($2::uuid IS NULL OR d.partner_id = $2)
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
    `SELECT ${VEHICLE_SELECT}
     FROM partner_vehicles v
     JOIN partners p ON p.id = v.partner_id AND p.deleted_at IS NULL
     LEFT JOIN uetds_companies uc ON uc.id = v.uetds_company_id
     WHERE v.id = $1
       AND v.deleted_at IS NULL
       AND ($2::uuid IS NULL OR v.partner_id = $2)
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
