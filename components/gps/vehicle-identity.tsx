import { gpsVehicleIdentity } from "@/lib/gps/vehicle-identity";

export function GpsVehicleIdentity({
  plate,
  brand = null,
  model = null,
  empty = null,
}: {
  plate: string | null;
  brand?: string | null;
  model?: string | null;
  empty?: string | null;
}) {
  const identity = gpsVehicleIdentity({ plate, brand, model });
  if (!identity) {
    return empty ? <p className="gps-vehicle-identity is-empty">{empty}</p> : null;
  }
  return (
    <p className="gps-vehicle-identity">
      <strong>{identity.plate}</strong>
      {identity.name ? <span>{` — ${identity.name}`}</span> : null}
    </p>
  );
}
