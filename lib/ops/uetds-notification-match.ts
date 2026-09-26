export type UetdsNotificationMatch =
  | { status: "eligible"; companyId: string }
  | { status: "external" }
  | { status: "mismatch" }
  | { status: "incomplete" };

function normalizeCompanyId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function matchUetdsNotificationCompanies(
  driverCompanyId: string | null | undefined,
  vehicleCompanyId: string | null | undefined,
): UetdsNotificationMatch {
  const driverId = normalizeCompanyId(driverCompanyId);
  const vehicleId = normalizeCompanyId(vehicleCompanyId);
  if (!driverId && !vehicleId) {
    return { status: "external" };
  }
  if (!driverId || !vehicleId) {
    return { status: "incomplete" };
  }
  if (driverId !== vehicleId) {
    return { status: "mismatch" };
  }
  return { status: "eligible", companyId: driverId };
}
