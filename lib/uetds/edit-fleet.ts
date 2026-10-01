import { evaluateUetdsEligibility, type UetdsEligibility } from "@/lib/uetds/eligibility";
import { foldUetdsSearchPlate } from "@/lib/uetds/edit-policy";
import { selectedFleetCompany, type UetdsFleetOption } from "@/lib/uetds/fleet-options";
import { type UetdsOzetPersonnel } from "@/lib/uetds/ministry-ozet-parse";

export type UetdsEditFleetIssue =
  | "unassigned"
  | "external"
  | "incomplete"
  | "mismatch"
  | "inactive"
  | "not-ready"
  | "company-mismatch"
  | "driver-identity"
  | "reservation-scope"
  | "subscription";

export function ministryPlateEquals(left: string | null | undefined, right: string | null | undefined) {
  const a = foldUetdsSearchPlate(left ?? "");
  const b = foldUetdsSearchPlate(right ?? "");
  return Boolean(a && a === b);
}

function foldIdentity(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

export function ministryPersonnelActive(personnel: UetdsOzetPersonnel[]) {
  return personnel.filter((item) => item.active);
}

export function ministryPersonnelHasIdentity(
  personnel: UetdsOzetPersonnel[],
  nationalId: string | null | undefined,
) {
  const expected = foldIdentity(nationalId);
  if (!expected) {
    return false;
  }
  return ministryPersonnelActive(personnel).some((item) => foldIdentity(item.nationalId) === expected);
}

export function evaluateUetdsEditFleet(input: {
  seferCompanyId: string;
  driver: UetdsFleetOption | null;
  vehicle: UetdsFleetOption | null;
  driverNationalId?: string | null;
  requireDriverIdentity?: boolean;
  reservationPartnerId?: string | null;
}): { ok: true; eligibility: UetdsEligibility } | { ok: false; error: UetdsEditFleetIssue } {
  const eligibility = evaluateUetdsEligibility({
    driverId: input.driver?.id,
    vehicleId: input.vehicle?.id,
    driverKind: input.driver ? "registered" : null,
    vehicleKind: input.vehicle ? "registered" : null,
    driverCompanyId: input.driver?.uetdsCompanyId ?? null,
    vehicleCompanyId: input.vehicle?.uetdsCompanyId ?? null,
    company: selectedFleetCompany(input.driver, input.vehicle),
  });
  if (!eligibility.ok) {
    const reason = eligibility.reason;
    if (reason === "eligible") {
      return { ok: false, error: "not-ready" };
    }
    if (reason === "unassigned-driver" || reason === "unassigned-vehicle") {
      return { ok: false, error: "unassigned" };
    }
    return { ok: false, error: reason };
  }
  if (!input.seferCompanyId || eligibility.companyId !== input.seferCompanyId) {
    return { ok: false, error: "company-mismatch" };
  }
  if (input.requireDriverIdentity && !input.driverNationalId?.trim()) {
    return { ok: false, error: "driver-identity" };
  }
  if (input.reservationPartnerId) {
    if (
      input.driver?.partnerId !== input.reservationPartnerId ||
      input.vehicle?.partnerId !== input.reservationPartnerId
    ) {
      return { ok: false, error: "reservation-scope" };
    }
  }
  return { ok: true, eligibility };
}
