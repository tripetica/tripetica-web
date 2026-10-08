export function soleGpsDevice<T extends { id: string }>(devices: T[]) {
  return devices.length === 1 ? devices[0] : null;
}
