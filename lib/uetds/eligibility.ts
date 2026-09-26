import {
  isUetdsCompanyStatus,
  isUetdsIntegrationStatus,
  type UetdsCompanyStatus,
  type UetdsIntegrationStatus,
} from "@/lib/ops/uetds-company-fields";
import { matchUetdsNotificationCompanies } from "@/lib/ops/uetds-notification-match";

export type UetdsCompanyReadiness = {
  id: string;
  shortName: string;
  status: UetdsCompanyStatus;
  integrationStatus: UetdsIntegrationStatus;
};

export type UetdsEligibilityReason =
  | "eligible"
  | "unassigned"
  | "unassigned-driver"
  | "unassigned-vehicle"
  | "external"
  | "incomplete"
  | "mismatch"
  | "inactive"
  | "not-ready";

export type UetdsEligibility = {
  ok: boolean;
  reason: UetdsEligibilityReason;
  companyId: string | null;
  companyShortName: string | null;
};

function text(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function mapUetdsCompanyReadiness(input: {
  id: string | null | undefined;
  shortName?: string | null;
  status?: string | null;
  integrationStatus?: string | null;
}): UetdsCompanyReadiness | null {
  const id = text(input.id);
  if (!id) {
    return null;
  }
  const status = input.status ?? "";
  const integrationStatus = input.integrationStatus ?? "";
  return {
    id,
    shortName: input.shortName?.trim() || "",
    status: isUetdsCompanyStatus(status) ? status : "inactive",
    integrationStatus: isUetdsIntegrationStatus(integrationStatus)
      ? integrationStatus
      : "incomplete",
  };
}

export function isUetdsCompanyUsable(company: UetdsCompanyReadiness | null | undefined) {
  return Boolean(company && company.status === "active" && company.integrationStatus === "ready");
}

export function evaluateUetdsEligibility(input: {
  driverId?: string | null;
  vehicleId?: string | null;
  driverKind?: string | null;
  vehicleKind?: string | null;
  driverCompanyId?: string | null;
  vehicleCompanyId?: string | null;
  company?: UetdsCompanyReadiness | null;
}): UetdsEligibility {
  const registeredDriver = input.driverKind !== "non_trp" && Boolean(text(input.driverId));
  const registeredVehicle = input.vehicleKind !== "non_trp" && Boolean(text(input.vehicleId));
  if (!registeredDriver && !registeredVehicle) {
    return { ok: false, reason: "unassigned", companyId: null, companyShortName: null };
  }
  if (!registeredDriver) {
    return { ok: false, reason: "unassigned-driver", companyId: null, companyShortName: null };
  }
  if (!registeredVehicle) {
    return { ok: false, reason: "unassigned-vehicle", companyId: null, companyShortName: null };
  }

  const match = matchUetdsNotificationCompanies(input.driverCompanyId, input.vehicleCompanyId);
  if (match.status === "external") {
    return { ok: false, reason: "external", companyId: null, companyShortName: null };
  }
  if (match.status === "incomplete") {
    return { ok: false, reason: "incomplete", companyId: null, companyShortName: null };
  }
  if (match.status === "mismatch") {
    return { ok: false, reason: "mismatch", companyId: null, companyShortName: null };
  }

  const company =
    input.company && input.company.id === match.companyId ? input.company : null;
  if (!company) {
    return {
      ok: false,
      reason: "not-ready",
      companyId: match.companyId,
      companyShortName: null,
    };
  }
  if (company.status !== "active") {
    return {
      ok: false,
      reason: "inactive",
      companyId: company.id,
      companyShortName: company.shortName || null,
    };
  }
  if (company.integrationStatus !== "ready") {
    return {
      ok: false,
      reason: "not-ready",
      companyId: company.id,
      companyShortName: company.shortName || null,
    };
  }
  return {
    ok: true,
    reason: "eligible",
    companyId: company.id,
    companyShortName: company.shortName || null,
  };
}
