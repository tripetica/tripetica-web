export type SubscriptionMoveDriver = {
  driverId: string;
  deleted: boolean;
  vehicleId: string | null;
  vehicleDeleted: boolean;
  standardEnabled: boolean;
  advancedEnabled: boolean;
  mobileEnabled: boolean;
  enrolled: boolean;
};

export type SubscriptionMove = {
  driverId: string;
  vehicleId: string;
};

export function planVehicleSubscriptionMove(drivers: readonly SubscriptionMoveDriver[]) {
  const active = drivers.filter((driver) => !driver.deleted);
  const byVehicle = new Map<string, SubscriptionMoveDriver[]>();
  for (const driver of active) {
    if (!driver.vehicleId || driver.vehicleDeleted) continue;
    const list = byVehicle.get(driver.vehicleId) ?? [];
    list.push(driver);
    byVehicle.set(driver.vehicleId, list);
  }
  const moves: SubscriptionMove[] = [];
  const unmatched: SubscriptionMoveDriver[] = [];
  for (const driver of active) {
    const signaled = driver.standardEnabled || driver.advancedEnabled || driver.mobileEnabled || driver.enrolled;
    if (!signaled) continue;
    if (!driver.vehicleId || driver.vehicleDeleted) {
      unmatched.push(driver);
      continue;
    }
    const sharing = byVehicle.get(driver.vehicleId) ?? [];
    if (sharing.length !== 1) {
      unmatched.push(driver);
      continue;
    }
    moves.push({ driverId: driver.driverId, vehicleId: driver.vehicleId });
  }
  return { moves, unmatched };
}

/**
 * A new GPS–ATS subscription needs an active physical tracker assigned to the
 * vehicle. An existing subscription can stay or be turned off. Online state,
 * a GNSS fix, and a finished installation are not required.
 */
export function gpsAtsEnableAllowed(input: {
  hasActivePhysicalDevice: boolean;
  currentlyEnabled: boolean;
  requestedEnabled: boolean;
}) {
  if (!input.requestedEnabled || input.currentlyEnabled) return true;
  return input.hasActivePhysicalDevice;
}

/** Physical ATS stays on the live device and also requires the vehicle GPS-ATS flag. */
export function physicalAtsSubscriptionAllows(input: {
  deviceActive: boolean;
  liveSource: boolean;
  assignedToVehicle: boolean;
  explicitlyDisabled: boolean;
  gpsAtsEnabled: boolean;
}) {
  if (input.explicitlyDisabled) return false;
  return input.deviceActive && input.liveSource && input.assignedToVehicle && input.gpsAtsEnabled;
}
