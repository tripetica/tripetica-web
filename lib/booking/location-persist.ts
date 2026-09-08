import { pickupAirportCode } from "@/lib/booking/meet-and-greet";
import { airportPresets } from "@/lib/booking/catalog";
import { bookingCopy } from "@/lib/booking/copy";
import {
  classifyTransferLocation,
  geoForAirportCode,
  isTrustedStoredProvince,
  canonicalDistrictCode,
  type LocationGeo,
} from "@/lib/booking/pricing/location-codes";
import {
  loadPlaceDetails,
  loadPlaceGeoDetails,
  type PlaceGeoDetails,
} from "@/lib/booking/places-server";
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

type LocationCanonicalizationDependencies = {
  loadPlaceGeoDetails(placeId: string): Promise<PlaceGeoDetails | null>;
  loadPlaceDisplayDetails(
    placeId: string,
    locale: Locale,
  ): Promise<{
    name: string | null;
    formattedAddress: string | null;
  } | null>;
};

const defaultCanonicalizationDependencies: LocationCanonicalizationDependencies = {
  loadPlaceGeoDetails,
  async loadPlaceDisplayDetails(placeId, locale) {
    return loadPlaceDetails({
      placeId,
      locale,
      sessionToken: "server-canonical-display",
    });
  },
};

export class UntrustedLocationError extends Error {
  constructor() {
    super("Location could not be verified by the server");
    this.name = "UntrustedLocationError";
  }
}

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
  dependencies: Partial<LocationCanonicalizationDependencies> =
    defaultCanonicalizationDependencies,
): Promise<PersistedLocation> {
  const airportCode = persistedAirportCode(location);
  const airport = airportPresets.find((preset) => preset.id === airportCode);
  if (airport) {
    const geo = geoForAirportCode(airport.id);
    return {
      nameCustomer: bookingCopy[locale].airports[airport.id],
      addressCustomer: airport.formattedAddress,
      nameTr: bookingCopy.tr.airports[airport.id],
      addressTr: airport.formattedAddress,
      placeId: airport.placeId,
      latitude: airport.lat,
      longitude: airport.lng,
      locationType: "airport",
      airportCode: airport.id,
      provinceCode: geo?.provinceCode ?? null,
      districtCode: geo?.districtCode ?? null,
    };
  }

  const placeId = textOrNull(location.placeId);
  if (placeId) {
    const details = await (
      dependencies.loadPlaceGeoDetails ??
      defaultCanonicalizationDependencies.loadPlaceGeoDetails
    )(placeId);
    if (!details) {
      throw new UntrustedLocationError();
    }
    const displayDetails =
      locale === "tr"
        ? details
        : dependencies.loadPlaceDisplayDetails
          ? await dependencies.loadPlaceDisplayDetails(placeId, locale)
          : details;
    const latitude =
      details.lat != null &&
      Number.isFinite(details.lat) &&
      details.lat >= -90 &&
      details.lat <= 90
        ? details.lat
        : null;
    const longitude =
      details.lng != null &&
      Number.isFinite(details.lng) &&
      details.lng >= -180 &&
      details.lng <= 180
        ? details.lng
        : null;
    if (latitude === null || longitude === null) {
      throw new UntrustedLocationError();
    }
    const canonicalName =
      textOrNull(displayDetails?.name) ??
      textOrNull(displayDetails?.formattedAddress);
    const canonicalAddress = textOrNull(displayDetails?.formattedAddress);
    if (!canonicalName || !canonicalAddress) {
      throw new UntrustedLocationError();
    }
    const canonicalInput: LocationValue = {
      ...location,
      name: canonicalName ?? "",
      formattedAddress: canonicalAddress,
      placeId: details.placeId,
      lat: latitude,
      lng: longitude,
      city: details.city,
      district: details.district,
      region: details.region,
      country: details.country,
      countryCode: details.countryCode,
      airportCode: null,
      type: details.types.includes("airport") ? "airport" : "place",
      placeTypes: details.types,
    };
    const geo = classifyFromComponents(canonicalInput);
    return {
      nameCustomer: canonicalName,
      addressCustomer: canonicalAddress,
      nameTr: textOrNull(details.name) ?? textOrNull(details.formattedAddress),
      addressTr: textOrNull(details.formattedAddress),
      placeId: details.placeId,
      latitude,
      longitude,
      locationType: canonicalLocationType(canonicalInput),
      airportCode: null,
      provinceCode: geo.provinceCode,
      districtCode: geo.districtCode,
    };
  }

  if (!textOrNull(location.name)) {
    return {
      nameCustomer: null,
      addressCustomer: null,
      nameTr: null,
      addressTr: null,
      placeId: null,
      latitude: null,
      longitude: null,
      locationType: null,
      airportCode: null,
      provinceCode: null,
      districtCode: null,
    };
  }

  // A non-empty client location without a provider identity cannot safely
  // contribute coordinates or geo components to pricing.
  throw new UntrustedLocationError();
}
