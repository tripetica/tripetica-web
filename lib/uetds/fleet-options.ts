import { partnerDriverFullName } from "@/lib/partner/fleet-view";
import { type DriverMembershipStatus } from "@/lib/ops/driver-membership";
import { isUetdsCompanyUsable, type UetdsCompanyReadiness } from "@/lib/uetds/eligibility";

export type UetdsFleetScope = "partner" | "ops";

export type UetdsFleetOption = {
  id: string;
  label: string;
  partnerId: string;
  uetdsCompanyId: string | null;
  company: UetdsCompanyReadiness | null;
  hasNationalId?: boolean;
  membershipStatus?: DriverMembershipStatus;
  defaultVehicleId?: string | null;
  defaultAuthorityId?: string | null;
};

/** Initial selection only; lists already enforce fleet status and actor scope. */
export function initialUetdsFleetSelection(
  selection: { driverId: string; vehicleId: string },
  drivers: UetdsFleetOption[],
  vehicles: UetdsFleetOption[],
) {
  const usable = (option: UetdsFleetOption) =>
    isUetdsCompanyUsable(option.company) && option.uetdsCompanyId === option.company?.id;
  let driver = drivers.find((option) => option.id === selection.driverId);
  let vehicle = vehicles.find((option) => option.id === selection.vehicleId);
  if (!selection.driverId) {
    driver = drivers.find((option) => usable(option) && option.hasNationalId !== false &&
      (!selection.vehicleId || (vehicle && usable(vehicle) && option.uetdsCompanyId === vehicle.uetdsCompanyId)));
  }
  if (!selection.vehicleId) {
    vehicle = vehicles.find((option) => usable(option) &&
      (!(selection.driverId || driver) || (driver && usable(driver) && option.uetdsCompanyId === driver.uetdsCompanyId)));
  }
  return {
    driverId: selection.driverId || driver?.id || "",
    vehicleId: selection.vehicleId || vehicle?.id || "",
  };
}

export function uetdsDriverOptionLabel(input: {
  firstName: string;
  lastName: string;
  companyShortName?: string | null;
  partnerName?: string | null;
}) {
  return [
    partnerDriverFullName(input.firstName, input.lastName),
    input.companyShortName?.trim() || null,
    input.partnerName?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function uetdsVehicleOptionLabel(input: {
  plate: string;
  brand?: string | null;
  model?: string | null;
  companyShortName?: string | null;
  partnerName?: string | null;
}) {
  const brandModel = [input.brand, input.model]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" / ");
  return [
    input.plate.trim(),
    brandModel || null,
    input.companyShortName?.trim() || null,
    input.partnerName?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function selectedFleetCompany(
  driver: UetdsFleetOption | null | undefined,
  vehicle: UetdsFleetOption | null | undefined,
) {
  if (!driver?.company || !vehicle?.company) {
    return driver?.company ?? vehicle?.company ?? null;
  }
  return driver.company.id === vehicle.company.id ? driver.company : null;
}
