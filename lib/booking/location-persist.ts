import { pickupAirportCode } from "@/lib/booking/meet-and-greet";
import {
  classifyTransferLocation,
  geoForAirportCode,
  isTrustedStoredProvince,
  canonicalDistrictCode,
  type LocationGeo,
} from "@/lib/booking/pricing/location-codes";
import { loadPlaceGeoDetails } from "@/lib/booking/places-server";
import { type LocationValue } from "@/lib/booking/types";
import { type Locale } from "@/lib/i18n/config";

export type CanonicalLocationType =
  | "airport"
  | "hotel"
  | "address"
  | "poi"
  | "other";

export type PersistedLocation = {
  nameCustomer: string | null;
  addressCustomer: string | null;
  nameTr: string | null;
  addressTr: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  locationType: CanonicalLocationType | null;
  airportCode: string | null;
  provinceCode: string | null;
  districtCode: string | null;
};

export type GeoResolveInput = {
  placeId?: string | null;
  airportCode?: string | null;
  locationType?: string | null;
  type?: string | null;
  placeTypes?: string[] | null;
  provinceCode?: string | null;
  districtCode?: string | null;
  city?: string | null;
  district?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
};

const KNOWN_AIRPORT_CODES = new Set(["IST", "SAW", "AYT"]);

function textOrNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function typesOf(location: LocationValue) {
  return location.placeTypes ?? [];
}

function hasType(location: LocationValue, matches: string[]) {
  return typesOf(location).some((type) => matches.includes(type));
}

export function canonicalLocationType(
  location: LocationValue,
): CanonicalLocationType | null {
  if (
    location.type === "airport" ||
    Boolean(location.airportCode) ||
    hasType(location, ["airport"])
  ) {
    return "airport";
  }
  if (hasType(location, ["lodging", "hotel", "accommodation"])) {
    return "hotel";
  }
  if (
    hasType(location, ["street_address", "premise", "subpremise", "route"])
  ) {
    return "address";
  }
  if (
    hasType(location, [
      "point_of_interest",
      "establishment",
      "tourist_attraction",
    ])
  ) {
    return "poi";
  }
  if (location.type === "place") {
    return "other";
  }
  return null;
}

export function persistedAirportCode(location: {
  airportCode?: string | null;
  placeId?: string | null;
}) {
  const fromPreset = pickupAirportCode(location);
  if (fromPreset) {
    return fromPreset;
  }
  const code = location.airportCode?.trim().toUpperCase() ?? "";
  return KNOWN_AIRPORT_CODES.has(code) ? code : null;
}

function storedCanonicalGeo(location: GeoResolveInput): LocationGeo | null {
  if (!isTrustedStoredProvince(location.provinceCode)) {
    return null;
  }
  if (location.provinceCode !== "istanbul") {
    return { provinceCode: location.provinceCode, districtCode: null };
  }
  const district = canonicalDistrictCode(location.districtCode);
  return {
    provinceCode: "istanbul",
    districtCode: district,
  };
}

function classifyFromComponents(location: GeoResolveInput): LocationGeo {
  return classifyTransferLocation({
    city: location.city,
    district: location.district,
    region: location.region,
    country: location.country,
    countryCode: location.countryCode,
    airportCode: persistedAirportCode(location),
  });
}

export async function resolveLocationGeo(
  location: GeoResolveInput,
): Promise<LocationGeo> {
  const airportGeo = geoForAirportCode(persistedAirportCode(location));
  if (airportGeo) {
    return airportGeo;
  }

  const stored = storedCanonicalGeo(location);
  const placeId = textOrNull(location.placeId);
  if (stored && (location.provinceCode !== "istanbul" || stored.districtCode || !placeId)) {
    return stored;
  }

  if (placeId) {
    const geoDetails = await loadPlaceGeoDetails(placeId);
    if (geoDetails) {
      const airportFromTypes = geoDetails.types.includes("airport")
        ? persistedAirportCode({
            airportCode: location.airportCode,
            placeId,
          })
        : persistedAirportCode(location);
      return classifyTransferLocation({
        city: geoDetails.city,
        district: geoDetails.district,
        region: geoDetails.region,
        country: geoDetails.country,
        countryCode: geoDetails.countryCode,
        airportCode: airportFromTypes,
      });
    }
  }

  if (stored) {
    return stored;
  }

  return classifyFromComponents(location);
}

export async function toPersistedLocation(
  location: LocationValue,
  locale: Locale,
): Promise<PersistedLocation> {
  const nameCustomer = textOrNull(location.name);
  const addressCustomer = textOrNull(location.formattedAddress);
  const turkishAvailable = locale === "tr";
  const geo = await resolveLocationGeo(location);

  return {
    nameCustomer,
    addressCustomer,
    nameTr: turkishAvailable ? nameCustomer : null,
    addressTr: turkishAvailable ? addressCustomer : null,
    placeId: textOrNull(location.placeId),
    latitude: location.lat,
    longitude: location.lng,
    locationType: canonicalLocationType(location),
    airportCode: persistedAirportCode(location),
    provinceCode: geo.provinceCode,
    districtCode: geo.districtCode,
  };
}
