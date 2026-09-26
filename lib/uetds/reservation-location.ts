import { isOfficialUetdsLocationReady, type UetdsLocation } from "@/lib/uetds/location";
import { resolveOfficialUetdsLocation } from "@/lib/uetds/official-locations";

export type UetdsReservationPlaceInput = {
  name: string | null;
  address: string | null;
  placeId: string | null;
  locationType: string | null;
  airportCode: string | null;
};

export type UetdsReservationPlaceDetails = {
  name?: string | null;
  formattedAddress?: string | null;
  placeId?: string | null;
  city?: string | null;
  district?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  types?: string[];
};

function text(value: string | null | undefined) {
  return value?.trim() || "";
}

function reservationLooksLikeAirport(place: UetdsReservationPlaceInput) {
  if (place.locationType?.trim().toLowerCase() === "airport") {
    return true;
  }
  if (place.airportCode?.trim()) {
    return true;
  }
  return /havaliman|havaalan|airport/i.test(`${place.name ?? ""} ${place.address ?? ""}`);
}

function nameLooksLikeDistrictLabel(name: string) {
  const value = name.trim();
  if (!value || value.length > 24) {
    return false;
  }
  return !/hotel|hilton|airport|havaliman|havaalan|center|otel|conference|restaurant/i.test(value);
}

/** Map stored reservation place fields to official U-ETDS location. Never treat IATA as Ministry code. */
export function resolveUetdsLocationFromReservationPlace(
  place: UetdsReservationPlaceInput,
  details?: UetdsReservationPlaceDetails | null,
): UetdsLocation {
  const placeName = text(place.name) || text(details?.name);
  const formattedAddress =
    text(place.address) ||
    text(details?.formattedAddress) ||
    (!reservationLooksLikeAirport(place) && nameLooksLikeDistrictLabel(placeName) ? placeName : "");
  const airport = reservationLooksLikeAirport(place) || Boolean(details?.types?.includes("airport"));
  const location = resolveOfficialUetdsLocation({
    placeName,
    formattedAddress,
    googlePlaceId: text(place.placeId) || text(details?.placeId),
    details: {
      name: text(details?.name) || placeName,
      formattedAddress: text(details?.formattedAddress) || formattedAddress,
      placeId: text(details?.placeId) || text(place.placeId),
      city: details?.city,
      district: details?.district,
      region: details?.region,
      country: details?.country,
      countryCode: details?.countryCode,
      types: details?.types?.length ? details.types : airport ? ["airport"] : [],
    },
  });
  if (placeName) {
    location.placeName = placeName;
  }
  return location;
}

export function reservationPlaceNeedsDetails(location: UetdsLocation, placeId: string | null) {
  return Boolean(text(placeId)) && !isOfficialUetdsLocationReady(location);
}
