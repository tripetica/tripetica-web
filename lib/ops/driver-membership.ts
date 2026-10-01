export const DRIVER_MEMBERSHIP_STATUSES = ["standard", "gold"] as const;
export type DriverMembershipStatus = (typeof DRIVER_MEMBERSHIP_STATUSES)[number];
export function isDriverMembershipStatus(value: unknown): value is DriverMembershipStatus {
  return value === "standard" || value === "gold";
}
