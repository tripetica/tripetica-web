export const OPS_ROLES = ["owner", "employee"] as const;
export type OpsRole = (typeof OPS_ROLES)[number];

export const OPS_PERMISSIONS = [
  "reservations.view",
  "reservations.manage",
  "records.edit",
  "processes.view",
  "processes.delete",
  "customers.view",
  "partners.view",
  "partners.manage",
  "users.view",
  "users.manage",
] as const;

export type OpsPermission = (typeof OPS_PERMISSIONS)[number];

export const OPS_PERMISSION_SET = new Set<string>(OPS_PERMISSIONS);

export function isOpsRole(value: string): value is OpsRole {
  return (OPS_ROLES as readonly string[]).includes(value);
}

export function isOpsPermission(value: string): value is OpsPermission {
  return OPS_PERMISSION_SET.has(value);
}

export function normalizePermissionKeys(values: string[]): OpsPermission[] {
  const unique = new Set<OpsPermission>();
  for (const value of values) {
    if (isOpsPermission(value)) {
      unique.add(value);
    }
  }
  return OPS_PERMISSIONS.filter((key) => unique.has(key));
}

export function permissionsForRole(role: OpsRole, granted: string[]): OpsPermission[] {
  if (role === "owner") {
    return [...OPS_PERMISSIONS];
  }
  return normalizePermissionKeys(granted);
}

export function canEditOpsRecords(role: OpsRole): boolean {
  return role === "owner";
}

export function canDeleteOpsReservations(role: OpsRole): boolean {
  return role === "owner";
}

export function hasPermission(
  role: OpsRole,
  granted: readonly string[],
  permission: OpsPermission,
) {
  if (role === "owner") {
    return true;
  }
  return granted.includes(permission);
}
