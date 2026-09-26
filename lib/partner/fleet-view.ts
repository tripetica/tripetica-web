import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";

export type { UetdsCompanyRef };

export type PartnerFleetStatus = "active" | "inactive";
export type PartnerVehicleStatus =
  | "active"
  | "inactive"
  | "pending_approval"
  | "rejected";

export type PartnerDriverRecord = {
  id: string;
  partnerId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nationalId: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  email: string | null;
  languageCodes: string[];
  status: PartnerFleetStatus;
  deletedAt: string | null;
  updatedAt: string;
  uetdsCompanyId?: string | null;
  uetdsCompany?: UetdsCompanyRef | null;
};

export type PartnerVehicleRecord = {
  id: string;
  partnerId: string;
  plate: string;
  brandCode: string | null;
  modelCode: string | null;
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  colorCode: string | null;
  colorOther: string | null;
  color: string | null;
  passengerCapacity: number | null;
  luggageCapacity: number | null;
  vehicleClassCode: string | null;
  featureCodes: string[];
  featureOther: string | null;
  features: string | null;
  status: PartnerVehicleStatus;
  approvedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  uetdsCompanyId?: string | null;
  uetdsCompany?: UetdsCompanyRef | null;
};

export function mapUetdsCompanyLink(
  id: string | null | undefined,
  shortName: string | null | undefined,
): { uetdsCompanyId: string | null; uetdsCompany: UetdsCompanyRef | null } {
  if (!id) {
    return { uetdsCompanyId: null, uetdsCompany: null };
  }
  return {
    uetdsCompanyId: id,
    uetdsCompany: { id, shortName: shortName?.trim() || "" },
  };
}

export function formatUetdsCompanyListLabel(
  company: UetdsCompanyRef | null | undefined,
  externalLabel: string,
) {
  return company?.shortName.trim() || externalLabel;
}

export function partnerDriverFullName(firstName: string, lastName: string) {
  return [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ");
}

export function partnerVehicleBrandModel(vehicle: Pick<PartnerVehicleRecord, "brand" | "model">) {
  const value = [vehicle.brand, vehicle.model]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" / ");
  return value || "—";
}

export function partnerVehicleCapacityLabel(
  vehicle: Pick<PartnerVehicleRecord, "passengerCapacity" | "luggageCapacity">,
  copy: { vehiclePassengersShort: string; vehicleBagsShort: string },
) {
  if (vehicle.passengerCapacity == null && vehicle.luggageCapacity == null) {
    return "—";
  }
  const passengers =
    vehicle.passengerCapacity == null
      ? "—"
      : `${vehicle.passengerCapacity} ${copy.vehiclePassengersShort}`;
  const bags =
    vehicle.luggageCapacity == null
      ? "—"
      : `${vehicle.luggageCapacity} ${copy.vehicleBagsShort}`;
  return `${passengers} / ${bags}`;
}

export function isPartnerFleetAssignable(input: {
  status: PartnerFleetStatus | PartnerVehicleStatus;
  deletedAt: string | null;
}) {
  return input.status === "active" && !input.deletedAt;
}

export function formatPartnerFleetPhone(e164: string | null) {
  if (!e164?.trim()) {
    return "—";
  }
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

export function vehicleStatusBadgeClass(status: PartnerVehicleStatus | PartnerFleetStatus) {
  if (status === "pending_approval") {
    return "is-pending";
  }
  if (status === "active") {
    return "is-active";
  }
  return "is-inactive";
}
