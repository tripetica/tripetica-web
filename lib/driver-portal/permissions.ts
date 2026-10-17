export const driverGpsPermissionKeys = [
  "gpsLive",
  "gpsHistory",
  "gpsMaintenance",
  "gpsDrive",
  "gpsDevice",
] as const;

export const driverUetdsPermissionKeys = ["uetdsNew", "uetdsList"] as const;

export const driverPermissionKeys = [
  ...driverGpsPermissionKeys,
  ...driverUetdsPermissionKeys,
] as const;

export type DriverPermissionKey = (typeof driverPermissionKeys)[number];

export type DriverPermissions = Record<DriverPermissionKey, boolean>;

export function emptyDriverPermissions(): DriverPermissions {
  return {
    gpsLive: false,
    gpsHistory: false,
    gpsMaintenance: false,
    gpsDrive: false,
    gpsDevice: false,
    uetdsNew: false,
    uetdsList: false,
  };
}

export function parseDriverPermissions(value: unknown): DriverPermissions {
  const permissions = emptyDriverPermissions();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return permissions;
  }
  const record = value as Record<string, unknown>;
  for (const key of driverPermissionKeys) {
    permissions[key] = record[key] === true;
  }
  return permissions;
}

export function driverPermissionGroupState(
  permissions: DriverPermissions,
  keys: readonly DriverPermissionKey[],
) {
  const selected = keys.filter((key) => permissions[key]).length;
  if (selected === 0) return "none" as const;
  if (selected === keys.length) return "all" as const;
  return "some" as const;
}

export function setDriverPermissionGroup(
  permissions: DriverPermissions,
  keys: readonly DriverPermissionKey[],
  enabled: boolean,
): DriverPermissions {
  const next = { ...permissions };
  for (const key of keys) next[key] = enabled;
  return next;
}

export function driverHasGpsAccess(permissions: DriverPermissions) {
  return driverGpsPermissionKeys.some((key) => permissions[key]);
}

export function driverHasUetdsAccess(permissions: DriverPermissions) {
  return driverUetdsPermissionKeys.some((key) => permissions[key]);
}
