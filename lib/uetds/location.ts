export const UETDS_LOCATION_TYPES = ["district", "airport", "foreign"] as const;
export type UetdsLocationType = (typeof UETDS_LOCATION_TYPES)[number];

export type UetdsLocation = {
  countryCode: string;
  provinceCode: string;
  provinceName: string;
  locationType: UetdsLocationType;
  districtOrAirportCode: string;
  districtOrAirportName: string;
  placeName: string;
  formattedAddress: string;
  googlePlaceId: string;
  review: boolean;
};

export function emptyUetdsLocation(): UetdsLocation {
  return {
    countryCode: "TR",
    provinceCode: "",
    provinceName: "",
    locationType: "district",
    districtOrAirportCode: "",
    districtOrAirportName: "",
    placeName: "",
    formattedAddress: "",
    googlePlaceId: "",
    review: false,
  };
}

export function isUetdsLocationType(value: string): value is UetdsLocationType {
  return (UETDS_LOCATION_TYPES as readonly string[]).includes(value);
}

export function parseUetdsLocation(raw: unknown): UetdsLocation {
  const empty = emptyUetdsLocation();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return empty;
  }
  const value = raw as Partial<UetdsLocation>;
  const rawType = String(value.locationType ?? "");
  const locationType: UetdsLocationType = isUetdsLocationType(rawType) ? rawType : "district";
  return {
    countryCode: String(value.countryCode ?? empty.countryCode).trim().toUpperCase() || "TR",
    provinceCode: String(value.provinceCode ?? "").trim(),
    provinceName: String(value.provinceName ?? "").trim(),
    locationType,
    districtOrAirportCode: String(value.districtOrAirportCode ?? "").trim(),
    districtOrAirportName: String(value.districtOrAirportName ?? "").trim(),
    placeName: String(value.placeName ?? "").trim(),
    formattedAddress: String(value.formattedAddress ?? "").trim(),
    googlePlaceId: String(value.googlePlaceId ?? "").trim(),
    review: Boolean(value.review),
  };
}

export function uetdsLocationLabel(location: UetdsLocation) {
  return location.placeName.trim() || location.districtOrAirportName.trim() || "";
}

export function uetdsLocationOfficialLabel(location: UetdsLocation) {
  const local = location.districtOrAirportName.trim();
  const province = location.provinceName.trim();
  if (local && province) {
    return `${local} / ${province}`;
  }
  return local || province;
}

/** Operational pickup/dropoff display kept in Tripetica (not ministry codes). */
export function uetdsLocationOperationalPrimary(location: UetdsLocation) {
  return location.placeName.trim() || location.districtOrAirportName.trim() || "";
}

export function uetdsLocationOperationalSecondary(location: UetdsLocation) {
  const primary = uetdsLocationOperationalPrimary(location);
  const address = location.formattedAddress.trim();
  if (!address || address === primary) {
    return "";
  }
  return address;
}

/**
 * Free-text SOAP `baslangicYer` / `bitisYer`.
 *
 * Ministry PDF composes roughly `{Yer} {IlceName}/{IlName}`.
 * - District: Ilce code already expands to the district name — leave Yer empty
 *   so PDF shows `ZEYTİNBURNU/İSTANBUL`, not `ZEYTİNBURNU ZEYTİNBURNU/İSTANBUL`.
 * - Airport (99xxx): PDF uses Yer as the visible place name — send official airport name.
 * - Unresolved / other: keep operational placeName fallback.
 */
export function uetdsMinistryYerText(location: UetdsLocation) {
  if (isOfficialUetdsLocationReady(location)) {
    if (location.locationType === "district") {
      return "";
    }
    if (location.locationType === "airport") {
      return location.districtOrAirportName.trim();
    }
  }
  return location.placeName.trim() || location.districtOrAirportName.trim();
}

export function isOfficialUetdsLocationReady(location: UetdsLocation) {
  if (location.review) {
    return false;
  }
  if (location.locationType === "foreign") {
    return Boolean(location.countryCode && location.countryCode !== "TR" && uetdsLocationLabel(location));
  }
  return Boolean(
    location.countryCode === "TR" &&
      location.provinceCode &&
      location.provinceName &&
      location.districtOrAirportCode &&
      location.districtOrAirportName &&
      (location.locationType === "district" || location.locationType === "airport"),
  );
}

export function locationFromPlaceName(placeName: string, review = true): UetdsLocation {
  const location = emptyUetdsLocation();
  location.placeName = placeName.trim();
  location.review = Boolean(placeName.trim()) && review;
  return location;
}
