export const serviceIds = [
  "airport-transfer",
  "hourly-chauffeur",
  "istanbul-layover-tour",
  "istanbul-city-tour",
  "istanbul-bosphorus-dinner-cruise",
  "sapanca-tour",
  "bursa-tour",
  "private-turkey-tours",
] as const;

export type ServiceId = (typeof serviceIds)[number];

export function servicePath(id: ServiceId) {
  return `/services/${id}`;
}
