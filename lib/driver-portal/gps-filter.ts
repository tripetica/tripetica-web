export function assignedGpsItems<T extends { vehicleId?: string | null }>(
  items: readonly T[],
  vehicleIds: readonly string[],
) {
  const allowed = new Set(vehicleIds);
  return items.filter((item) => Boolean(item.vehicleId && allowed.has(item.vehicleId)));
}
