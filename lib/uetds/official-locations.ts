// Official UAB U-ETDS ilce_listesi / ulke_listesi published at
// https://uetds.uab.gov.tr/teknik-dokuman — airport codes are 99xxx, not IATA.
import officialCountries from "@/lib/uetds/data/official-countries.json";
import officialPlaces from "@/lib/uetds/data/official-places.json";
import {
  emptyUetdsLocation,
  type UetdsLocation,
  type UetdsLocationType,
} from "@/lib/uetds/location";

export type OfficialUetdsPlace = {
  code: string;
  name: string;
  provinceCode: string;
  provinceName: string;
  kind: "district" | "airport";
};

export type OfficialUetdsCountry = {
  code: string;
  name: string;
};

export type OfficialUetdsProvince = {
  code: string;
  name: string;
};

type PlaceDetailsLike = {
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

const PLACES = officialPlaces as OfficialUetdsPlace[];
const COUNTRIES = officialCountries as OfficialUetdsCountry[];

function fold(value: string) {
  return value
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function sameName(left: string, right: string) {
  const a = fold(left);
  const b = fold(right);
  return Boolean(a && a === b);
}

function containsName(haystack: string, needle: string) {
  const a = fold(haystack);
  const b = fold(needle);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function stripDisplayIata(value: string) {
  return value.replace(/\([A-Za-z]{3}\)/g, " ");
}

function airportMatchKey(value: string) {
  let folded = fold(stripDisplayIata(value));
  folded = folded
    .replace(/\bINTERNATIONAL\b/g, " ")
    .replace(/\bULUSLARARASI\b/g, " ")
    .replace(/\bINTL\b/g, " ")
    .replace(/\bAIRPORT\b/g, " HAVALIMANI ")
    .replace(/\bHAVAALANI\b/g, " HAVALIMANI ")
    .replace(/\bHAVALIMAN\b/g, " HAVALIMANI ")
    .replace(/\s+/g, " ")
    .trim();
  folded = folded.replace(/\bHAVALIMANI [A-Z]{3}\b/g, "HAVALIMANI").replace(/\s+/g, " ").trim();
  return folded;
}

function isGenericAirportQuery(query: string) {
  return !query || query === "HAVALIMANI" || query === "AIRPORT";
}

function matchOfficialAirport(
  names: Array<string | null | undefined>,
  provinceCode?: string,
) {
  const pool = PLACES.filter(
    (place) =>
      place.kind === "airport" &&
      (!provinceCode || place.provinceCode === provinceCode),
  );
  const queries = names.map((name) => airportMatchKey(name ?? "")).filter((query) => !isGenericAirportQuery(query));
  for (const query of queries) {
    const exact = pool.find((place) => airportMatchKey(place.name) === query);
    if (exact) {
      return exact;
    }
  }
  for (const query of queries) {
    const hits = pool.filter((place) => {
      const official = airportMatchKey(place.name);
      return official && (query === official || query.includes(official) || official.includes(query));
    });
    if (hits.length === 1) {
      return hits[0] ?? null;
    }
    if (hits.length > 1) {
      const contained = hits.filter((place) => query.includes(airportMatchKey(place.name)));
      const ranked = (contained.length > 0 ? contained : hits).slice().sort(
        (left, right) => airportMatchKey(right.name).length - airportMatchKey(left.name).length,
      );
      return ranked[0] ?? null;
    }
  }
  // Distinctive token match: "Sabiha Havalimanı" → unique Sabiha Gökçen among airports.
  for (const query of queries) {
    const tokens = query
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token && token !== "HAVALIMANI" && token.length >= 4);
    for (const token of tokens) {
      const hits = pool.filter((place) => {
        const official = airportMatchKey(place.name);
        return official === token || hasFoldedWord(official, token) || official.includes(token);
      });
      if (hits.length === 1) {
        return hits[0] ?? null;
      }
    }
  }
  return null;
}

function isGenericDistrictName(name: string) {
  return fold(name) === "MERKEZ";
}

function hasFoldedWord(haystack: string, needle: string) {
  const source = fold(haystack);
  const word = fold(needle);
  return Boolean(source && word && new RegExp(`(?:^| )${word}(?: |$)`).test(source));
}

function matchOfficialProvinceFromText(text: string) {
  const source = fold(text);
  if (!source) {
    return null;
  }
  const hits = officialUetdsProvinces().filter((province) => hasFoldedWord(text, province.name));
  if (hits.length === 1) {
    return hits[0] ?? null;
  }
  if (hits.length > 1) {
    return hits.slice().sort((left, right) => fold(right.name).length - fold(left.name).length)[0] ?? null;
  }
  return null;
}

function matchOfficialDistrictFromText(text: string, provinceCode?: string) {
  const source = fold(text);
  if (!source) {
    return null;
  }
  const pool = PLACES.filter(
    (place) =>
      place.kind === "district" &&
      (!provinceCode || place.provinceCode === provinceCode) &&
      !isGenericDistrictName(place.name),
  );
  const hits = pool.filter((place) => {
    const official = fold(place.name);
    return official.length >= 4 && containsName(source, official);
  });
  if (hits.length === 1) {
    return hits[0] ?? null;
  }
  if (hits.length > 1) {
    const ranked = hits.slice().sort((left, right) => fold(right.name).length - fold(left.name).length);
    const longest = fold(ranked[0]?.name ?? "");
    const tied = ranked.filter((place) => fold(place.name) === longest);
    if (tied.length === 1) {
      return tied[0] ?? null;
    }
    return null;
  }
  return null;
}

export function officialUetdsCountries() {
  return COUNTRIES;
}

export function officialUetdsPlaces() {
  return PLACES;
}

export function officialUetdsProvinces(): OfficialUetdsProvince[] {
  const seen = new Map<string, OfficialUetdsProvince>();
  for (const place of PLACES) {
    if (!seen.has(place.provinceCode)) {
      seen.set(place.provinceCode, {
        code: place.provinceCode,
        name: place.provinceName,
      });
    }
  }
  return [...seen.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "tr"),
  );
}

export function officialUetdsPlacesInProvince(
  provinceCode: string,
  kind: OfficialUetdsPlace["kind"],
) {
  return PLACES.filter(
    (place) => place.provinceCode === provinceCode && place.kind === kind,
  ).sort((left, right) => left.name.localeCompare(right.name, "tr"));
}

export function officialUetdsCountryByCode(code: string) {
  const folded = code.trim().toUpperCase();
  return COUNTRIES.find((country) => country.code.toUpperCase() === folded) ?? null;
}

export function matchOfficialProvince(name: string | null | undefined) {
  const source = name?.trim() ?? "";
  if (!source) {
    return null;
  }
  return officialUetdsProvinces().find((province) => sameName(province.name, source)) ?? null;
}

export function matchOfficialPlace(input: {
  provinceCode?: string;
  name?: string | null;
  kind?: OfficialUetdsPlace["kind"];
}) {
  const source = input.name?.trim() ?? "";
  if (!source) {
    return null;
  }
  const pool = PLACES.filter((place) => {
    if (input.provinceCode && place.provinceCode !== input.provinceCode) {
      return false;
    }
    if (input.kind && place.kind !== input.kind) {
      return false;
    }
    return true;
  });
  return (
    pool.find((place) => sameName(place.name, source)) ??
    pool.find((place) => containsName(place.name, source) || containsName(source, place.name)) ??
    null
  );
}

function looksLikeAirport(details: PlaceDetailsLike, placeName: string) {
  const types = details.types ?? [];
  if (types.includes("airport")) {
    return true;
  }
  return /havaliman|havaalan|airport/i.test(placeName);
}

export function resolveOfficialUetdsLocation(input: {
  details?: PlaceDetailsLike | null;
  placeName?: string;
  formattedAddress?: string;
  googlePlaceId?: string;
}): UetdsLocation {
  const details = input.details ?? {};
  const placeName =
    input.placeName?.trim() || details.name?.trim() || "";
  const location = emptyUetdsLocation();
  location.placeName = placeName;
  location.formattedAddress = input.formattedAddress?.trim() || details.formattedAddress?.trim() || "";
  location.googlePlaceId = input.googlePlaceId?.trim() || details.placeId?.trim() || "";

  const countryCode = (details.countryCode ?? "").trim().toUpperCase();
  const officialCountry = countryCode ? officialUetdsCountryByCode(countryCode) : officialUetdsCountryByCode("TR");
  if (officialCountry) {
    location.countryCode = officialCountry.code;
  }
  if (officialCountry && officialCountry.code !== "TR") {
    location.locationType = "foreign";
    location.review = !placeName;
    return location;
  }

  const province =
    matchOfficialProvince(details.region) ??
    matchOfficialProvince(details.city) ??
    matchOfficialProvince(placeName) ??
    matchOfficialProvinceFromText(
      [details.region, details.city, location.formattedAddress].filter(Boolean).join(" "),
    );
  if (province) {
    location.provinceCode = province.code;
    location.provinceName = province.name;
  }

  if (looksLikeAirport(details, `${placeName} ${location.formattedAddress}`)) {
    const airport =
      matchOfficialAirport(
        [placeName, details.name, location.formattedAddress],
        province?.code,
      ) ??
      matchOfficialAirport([placeName, details.name, location.formattedAddress]);
    if (airport) {
      location.locationType = "airport";
      location.provinceCode = airport.provinceCode;
      location.provinceName = airport.provinceName;
      location.districtOrAirportCode = airport.code;
      location.districtOrAirportName = airport.name;
      location.review = false;
      return location;
    }
    location.locationType = "airport";
    location.review = true;
    return location;
  }

  const explicitDistrict = details.district?.trim() || "";
  const districtHaystack = [
    explicitDistrict,
    details.city,
    placeName,
    location.formattedAddress,
  ]
    .filter(Boolean)
    .join(" ");
  const district =
    matchOfficialPlace({
      provinceCode: province?.code,
      name: explicitDistrict,
      kind: "district",
    }) ??
    (!isGenericDistrictName(explicitDistrict)
      ? matchOfficialPlace({
          name: explicitDistrict,
          kind: "district",
        })
      : null) ??
    matchOfficialDistrictFromText(districtHaystack, province?.code) ??
    matchOfficialDistrictFromText(districtHaystack);
  if (district) {
    location.locationType = "district";
    location.provinceCode = district.provinceCode;
    location.provinceName = district.provinceName;
    location.districtOrAirportCode = district.code;
    location.districtOrAirportName = district.name;
    location.review = false;
    return location;
  }

  location.locationType = "district";
  location.review = true;
  return location;
}

export function applyOfficialLocationSelection(input: {
  current: UetdsLocation;
  locationType: UetdsLocationType;
  provinceCode?: string;
  districtOrAirportCode?: string;
}): UetdsLocation {
  // Keep operational placeName / formattedAddress; only swap official codes.
  const next = { ...input.current, locationType: input.locationType, review: true };
  const province = officialUetdsProvinces().find((item) => item.code === input.provinceCode);
  next.provinceCode = province?.code ?? "";
  next.provinceName = province?.name ?? "";
  const place = officialUetdsPlacesInProvince(
    next.provinceCode,
    input.locationType === "airport" ? "airport" : "district",
  ).find((item) => item.code === input.districtOrAirportCode);
  next.districtOrAirportCode = place?.code ?? "";
  next.districtOrAirportName = place?.name ?? "";
  if (place && !next.placeName.trim()) {
    next.placeName = place.name;
  }
  next.review = !(next.provinceCode && next.districtOrAirportCode && place);
  return next;
}

export function officialLocationIdentityKey(location: UetdsLocation) {
  return `${location.locationType}:${location.provinceCode}:${location.districtOrAirportCode}`;
}
