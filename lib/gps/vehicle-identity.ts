export function gpsVehicleIdentity(input: {
  plate: string | null;
  brand?: string | null;
  model?: string | null;
}) {
  const plate = input.plate?.trim() ?? "";
  if (!plate) return null;
  const name = [input.brand, input.model].map((part) => part?.trim() ?? "").filter(Boolean).join(" ");
  return { plate, name: name || null };
}
