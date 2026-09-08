import { classifyTransferLocation } from "@/lib/booking/pricing/location-codes";
import { isLocationFilled, type LocationValue } from "@/lib/booking/types";

export function locationGeoFromValue(
  location: LocationValue,
): ReturnType<typeof classifyTransferLocation> {
  return classifyTransferLocation({
    airportCode: location.airportCode,
    city: location.city,
    district: location.district,
    region: location.region,
    country: location.country,
    countryCode: location.countryCode,
  });
}

export function isIstanbulLocationValue(
  location: LocationValue | null | undefined,
): boolean {
  if (!location || !isLocationFilled(location)) {
    return false;
  }
  return locationGeoFromValue(location).provinceCode === "istanbul";
}
