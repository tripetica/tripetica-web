export type OpsFleetChoice = {
  id: string;
  partnerId: string;
  partnerName: string;
  plate: string | null;
  driverName: string | null;
  deviceCode: string;
  source: "device" | "mobile";
};

export type OpsFleetGroup = {
  partnerId: string;
  partnerName: string;
  vehicles: OpsFleetChoice[];
};

function fold(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function vehicleSortLabel(vehicle: OpsFleetChoice) {
  return vehicle.plate?.trim() || vehicle.driverName?.trim() || vehicle.deviceCode;
}

export function groupOpsFleet(vehicles: readonly OpsFleetChoice[]): OpsFleetGroup[] {
  const groups = new Map<string, OpsFleetGroup>();
  for (const vehicle of vehicles) {
    const current = groups.get(vehicle.partnerId) ?? {
      partnerId: vehicle.partnerId,
      partnerName: vehicle.partnerName,
      vehicles: [],
    };
    current.vehicles.push(vehicle);
    groups.set(vehicle.partnerId, current);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      vehicles: [...group.vehicles].sort((left, right) => vehicleSortLabel(left).localeCompare(vehicleSortLabel(right), "tr")),
    }))
    .sort((left, right) => left.partnerName.localeCompare(right.partnerName, "tr"));
}

/** Narrow the visible rows. Selection is intentionally left untouched. */
export function searchOpsFleet(groups: readonly OpsFleetGroup[], query: string): OpsFleetGroup[] {
  const needle = fold(query);
  if (!needle) return [...groups];
  return groups.flatMap((group) => {
    if (fold(group.partnerName).includes(needle)) return [group];
    const vehicles = group.vehicles.filter((vehicle) =>
      fold(vehicle.plate ?? "").includes(needle)
      || fold(vehicle.driverName ?? "").includes(needle)
      || fold(vehicle.deviceCode).includes(needle));
    return vehicles.length > 0 ? [{ ...group, vehicles }] : [];
  });
}

export function partnerSelection(ids: readonly string[], selected: ReadonlySet<string>): "all" | "some" | "none" {
  if (ids.length === 0) return "none";
  const count = ids.filter((id) => selected.has(id)).length;
  if (count === 0) return "none";
  if (count === ids.length) return "all";
  return "some";
}

export function togglePartnerSelection(selected: ReadonlySet<string>, ids: readonly string[], on: boolean) {
  const next = new Set(selected);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function toggleVehicleSelection(selected: ReadonlySet<string>, id: string) {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function visibleFleetIds<T extends { id: string }>(vehicles: readonly T[], selected: ReadonlySet<string>) {
  return vehicles.filter((vehicle) => selected.has(vehicle.id));
}

/**
 * Newly seen vehicles start selected. A vehicle the operator cleared stays cleared.
 * Vehicles that left the fleet drop out of the selection.
 */
export function adoptFleetSelection(
  previous: ReadonlySet<string>,
  seen: ReadonlySet<string>,
  nextIds: readonly string[],
) {
  const ids = new Set(nextIds);
  const selected = new Set([...previous].filter((id) => ids.has(id)));
  for (const id of ids) {
    if (!seen.has(id)) selected.add(id);
  }
  return { selected, seen: ids };
}
