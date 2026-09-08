export const HOURLY_DROPOFF_DISTANCE_FREE_KM = 10;
export const HOURLY_DROPOFF_DISTANCE_RATE_EUR = "0.50";

type RoutableLocation = {
  placeId: string | null;
  airportCode: string | null;
  latitude: number | null;
  longitude: number | null;
  nameCustomer?: string | null;
};

export function draftLocationsRepresentSamePlace(
  pickup: RoutableLocation,
  dropoff: RoutableLocation,
) {
  const placeA = pickup.placeId?.trim() ?? "";
  const placeB = dropoff.placeId?.trim() ?? "";
  if (placeA && placeB) {
    return placeA === placeB;
  }
  const airportA = pickup.airportCode?.trim().toUpperCase() ?? "";
  const airportB = dropoff.airportCode?.trim().toUpperCase() ?? "";
  if (airportA && airportB) {
    return airportA === airportB;
  }
  const latA = pickup.latitude;
  const lngA = pickup.longitude;
  const latB = dropoff.latitude;
  const lngB = dropoff.longitude;
  if (
    latA !== null &&
    lngA !== null &&
    latB !== null &&
    lngB !== null &&
    Math.abs(latA - latB) < 1e-6 &&
    Math.abs(lngA - lngB) < 1e-6
  ) {
    return true;
  }
  return false;
}

export function hourlyDropoffBillableDistanceKm(distanceKm: number) {
  if (!Number.isFinite(distanceKm) || distanceKm <= HOURLY_DROPOFF_DISTANCE_FREE_KM) {
    return 0;
  }
  return distanceKm - HOURLY_DROPOFF_DISTANCE_FREE_KM;
}

export function hourlyDropoffDistanceFeeEur(distanceKm: number) {
  const billable = hourlyDropoffBillableDistanceKm(distanceKm);
  if (billable <= 0) {
    return 0;
  }
  return Math.round(billable * Number(HOURLY_DROPOFF_DISTANCE_RATE_EUR) * 100) / 100;
}
