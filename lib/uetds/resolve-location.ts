import { type Locale } from "@/lib/i18n/config";
import { preferUetdsPlaceQuery } from "@/lib/uetds/place-query";
import {
  emptyUetdsLocation,
  isOfficialUetdsLocationReady,
  type UetdsLocation,
} from "@/lib/uetds/location";
import {
  officialLocationIdentityKey,
  resolveOfficialUetdsLocation,
} from "@/lib/uetds/official-locations";

export type UetdsPlaceSuggestionLike = {
  placeId: string;
  primaryText: string;
  secondaryText?: string;
  types?: string[];
};

export type UetdsPlaceDetailsLike = {
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

export type UetdsPlacesLookup = {
  search: (query: string) => Promise<UetdsPlaceSuggestionLike[]>;
  details: (placeId: string) => Promise<UetdsPlaceDetailsLike | null>;
};

/** Minimum score required to auto-select a Google Place after AI/text enrich. */
export const UETDS_PLACE_AUTO_SELECT_MIN_SCORE = 70;
/** Best candidate must beat the next rival official identity by at least this margin. */
export const UETDS_PLACE_AUTO_SELECT_SCORE_GAP = 25;

const GENERIC_PLACE_TYPES = new Set([
  "locality",
  "political",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "country",
  "geocode",
]);

const SPECIFIC_PLACE_TYPES = new Set([
  "lodging",
  "establishment",
  "point_of_interest",
  "airport",
  "hospital",
  "premise",
  "street_address",
  "subpremise",
]);

function fold(value: string) {
  return value
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function distinctiveTokens(value: string) {
  return fold(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        ![
          "THE",
          "HOTEL",
          "OTEL",
          "ISTANBUL",
          "TURKIYE",
          "TURKEY",
          "HAVALIMANI",
          "AIRPORT",
          "ULUSLARARASI",
          "INTERNATIONAL",
          "INTL",
        ].includes(token),
    );
}

function queryLooksLikeAirport(query: string) {
  const folded = fold(query);
  return (
    /\bHAVALIMANI\b|\bHAVAALANI\b|\bAIRPORT\b|\bINTL\b/.test(folded) ||
    /\b(SAW|IST|AYT|ESB|ADB|TZX|ASR|GZT|BJV|DLM|VAN|DIY|ERC|SZF|NOP|KSY|MQM|GNY|ISE|TEQ|ONQ|YEI|KZR)\b/.test(
      folded,
    )
  );
}

export function isGenericCityLabel(label: string, query: string) {
  const foldedLabel = fold(label);
  const foldedQuery = fold(query);
  if (!foldedLabel) {
    return true;
  }
  if (distinctiveTokens(query).length > 0 && foldedLabel.split(" ").length <= 2) {
    const queryHasExtra = distinctiveTokens(query).some((token) => !foldedLabel.includes(token));
    if (queryHasExtra && (foldedQuery.includes(foldedLabel) || foldedLabel.includes("ISTANBUL"))) {
      return true;
    }
  }
  return false;
}

export function scoreUetdsPlaceCandidate(input: {
  query: string;
  suggestion: UetdsPlaceSuggestionLike;
  location: UetdsLocation;
  baseline?: UetdsLocation | null;
}) {
  const queryFolded = fold(input.query);
  const primary = fold(input.suggestion.primaryText);
  const secondary = fold(input.suggestion.secondaryText ?? "");
  const types = [
    ...(input.suggestion.types ?? []),
    ...((input.location as { types?: string[] }).types ?? []),
  ];
  // Prefer suggestion types; details types live on resolve input only — pass via suggestion merge below.
  const detailTypes = input.suggestion.types ?? [];
  const allTypes = detailTypes.length ? detailTypes : types;
  let score = 0;

  if (primary === queryFolded) {
    score += 120;
  }
  if (primary.includes(queryFolded) || queryFolded.includes(primary)) {
    score += 45;
  }
  for (const token of distinctiveTokens(input.query)) {
    if (primary.includes(token) || secondary.includes(token) || fold(input.location.placeName).includes(token)) {
      score += 28;
    } else {
      score -= 12;
    }
  }
  if (allTypes.some((type) => SPECIFIC_PLACE_TYPES.has(type))) {
    score += 35;
  }
  if (allTypes.includes("airport") || input.location.locationType === "airport") {
    score += 40;
  }
  if (
    allTypes.some((type) => GENERIC_PLACE_TYPES.has(type)) &&
    !allTypes.some((type) => SPECIFIC_PLACE_TYPES.has(type))
  ) {
    score -= 70;
  }
  if (isOfficialUetdsLocationReady(input.location)) {
    score += 35;
  }
  if (
    isGenericCityLabel(input.suggestion.primaryText, input.query) ||
    isGenericCityLabel(input.location.placeName, input.query)
  ) {
    score -= 90;
  }
  if (queryLooksLikeAirport(input.query) && input.location.locationType === "airport" && isOfficialUetdsLocationReady(input.location)) {
    score += 45;
  }
  if (
    input.baseline &&
    isOfficialUetdsLocationReady(input.baseline) &&
    isOfficialUetdsLocationReady(input.location) &&
    officialLocationIdentityKey(input.baseline) === officialLocationIdentityKey(input.location)
  ) {
    // Text-level airport/district already agreed with Places — strong auto-select signal.
    score += 40;
  }
  if (
    input.baseline &&
    isOfficialUetdsLocationReady(input.baseline) &&
    isOfficialUetdsLocationReady(input.location) &&
    officialLocationIdentityKey(input.baseline) !== officialLocationIdentityKey(input.location)
  ) {
    score -= 35;
  }
  return score;
}

/**
 * Same pipeline as manual Google Places selection in the form:
 * Place details → resolveOfficialUetdsLocation → UetdsLocation.
 */
export function applyUetdsPlaceDetails(input: {
  details: UetdsPlaceDetailsLike | null;
  primaryText?: string;
  secondaryText?: string;
  suggestionTypes?: string[];
}): UetdsLocation {
  const fallbackName = input.primaryText?.trim() || "";
  const fallbackAddress = input.secondaryText?.trim() || "";
  const details = input.details
    ? {
        ...input.details,
        types: input.details.types?.length ? input.details.types : input.suggestionTypes,
      }
    : null;
  return resolveOfficialUetdsLocation({
    details: details
      ? {
          name: details.name,
          formattedAddress: details.formattedAddress,
          placeId: details.placeId,
          city: details.city,
          district: details.district,
          region: details.region,
          country: details.country,
          countryCode: details.countryCode,
          types: details.types,
        }
      : {
          name: fallbackName,
          formattedAddress: fallbackAddress,
          types: input.suggestionTypes,
        },
    placeName: details?.name?.trim() || fallbackName,
    formattedAddress: details?.formattedAddress?.trim() || fallbackAddress,
    googlePlaceId: details?.placeId?.trim() || "",
  });
}

function unresolvedFromQuery(query: string, formattedAddress = ""): UetdsLocation {
  return {
    ...emptyUetdsLocation(),
    placeName: query,
    formattedAddress,
    review: true,
  };
}

export type UetdsRankedPlaceCandidate = {
  suggestion: UetdsPlaceSuggestionLike;
  location: UetdsLocation;
  score: number;
};

/**
 * Confidence gate: auto-select only when best ready Place is uniquely ahead.
 * Never invents codes; never picks first suggestion blindly.
 */
export function pickAutoSelectedUetdsPlace(
  ranked: UetdsRankedPlaceCandidate[],
  query: string,
): UetdsLocation | null {
  const eligible = ranked.filter(
    (item) =>
      item.score >= UETDS_PLACE_AUTO_SELECT_MIN_SCORE &&
      isOfficialUetdsLocationReady(item.location) &&
      !isGenericCityLabel(item.location.placeName, query) &&
      !isGenericCityLabel(item.suggestion.primaryText, query),
  );
  if (eligible.length === 0) {
    return null;
  }
  const best = eligible[0]!;
  const rival = ranked.find(
    (item) =>
      item !== best &&
      item.score >= best.score - UETDS_PLACE_AUTO_SELECT_SCORE_GAP &&
      isOfficialUetdsLocationReady(item.location) &&
      !isGenericCityLabel(item.location.placeName, query) &&
      officialLocationIdentityKey(item.location) !== officialLocationIdentityKey(best.location),
  );
  if (rival) {
    return null;
  }
  return best.location;
}

/**
 * Text → Places search/details → confidence auto-select via the same Place pipeline as manual UI.
 */
export async function enrichUetdsLocationFromText(
  query: string,
  lookup?: UetdsPlacesLookup,
): Promise<UetdsLocation> {
  const trimmed = preferUetdsPlaceQuery(query);
  if (!trimmed) {
    return emptyUetdsLocation();
  }

  const baseline = resolveOfficialUetdsLocation({
    placeName: trimmed,
    formattedAddress: query.trim() || trimmed,
  });
  baseline.placeName = trimmed;

  if (!lookup) {
    return baseline;
  }

  let suggestions: UetdsPlaceSuggestionLike[] = [];
  try {
    suggestions = await lookup.search(trimmed);
  } catch {
    return baseline;
  }
  if (suggestions.length === 0) {
    return baseline;
  }

  const ranked: UetdsRankedPlaceCandidate[] = [];
  for (const suggestion of suggestions.slice(0, 5)) {
    let details: UetdsPlaceDetailsLike | null = null;
    try {
      details = await lookup.details(suggestion.placeId);
    } catch {
      details = null;
    }
    const location = applyUetdsPlaceDetails({
      details,
      primaryText: suggestion.primaryText || trimmed,
      secondaryText: suggestion.secondaryText || "",
      suggestionTypes: suggestion.types,
    });
    // Merge detail types onto suggestion for scoring when autocomplete omitted them.
    const scoredSuggestion: UetdsPlaceSuggestionLike = {
      ...suggestion,
      types: suggestion.types?.length ? suggestion.types : details?.types,
    };
    ranked.push({
      suggestion: scoredSuggestion,
      location,
      score: scoreUetdsPlaceCandidate({
        query: trimmed,
        suggestion: scoredSuggestion,
        location,
        baseline,
      }),
    });
  }

  ranked.sort((left, right) => right.score - left.score);
  const auto = pickAutoSelectedUetdsPlace(ranked, trimmed);
  if (auto) {
    // Successful Place auto-select keeps Google operational name/address (manual path parity).
    return auto;
  }

  // No high-confidence Place pick — keep text baseline only when it already resolved uniquely
  // without pretending we selected a Google Place.
  if (isOfficialUetdsLocationReady(baseline) && ranked.every((item) => item.score < UETDS_PLACE_AUTO_SELECT_MIN_SCORE)) {
    return baseline;
  }

  return unresolvedFromQuery(trimmed);
}

export async function enrichUetdsDraftLocationsFromText(
  draft: {
    origin: string;
    destination: string;
    originLocation: UetdsLocation;
    destinationLocation: UetdsLocation;
    originReview: boolean;
    destinationReview: boolean;
  },
  lookup?: UetdsPlacesLookup,
) {
  const next = { ...draft };
  for (const key of ["origin", "destination"] as const) {
    const locationKey = key === "origin" ? "originLocation" : "destinationLocation";
    const reviewKey = key === "origin" ? "originReview" : "destinationReview";
    const query = next[key].trim() || next[locationKey].placeName.trim();
    if (!query) {
      continue;
    }
    const enriched = await enrichUetdsLocationFromText(query, lookup);
    // Only fall back to raw query when auto-select did not produce a Place-backed label.
    if (enriched.review && (!enriched.placeName.trim() || isGenericCityLabel(enriched.placeName, query))) {
      enriched.placeName = query;
    } else if (!enriched.placeName.trim()) {
      enriched.placeName = query;
    }
    next[locationKey] = enriched;
    next[reviewKey] = enriched.review;
    next[key] = enriched.placeName.trim() || query;
  }
  return next;
}

export function createBrowserUetdsPlacesLookup(locale: Locale): UetdsPlacesLookup {
  return {
    async search(query) {
      const { fetchPlaceSuggestions } = await import("@/lib/booking/places-client");
      const sessionToken = crypto.randomUUID();
      const result = await fetchPlaceSuggestions({ query, locale, sessionToken });
      return result.suggestions.map((item) => ({
        placeId: item.placeId,
        primaryText: item.primaryText,
        secondaryText: item.secondaryText,
        types: item.types,
      }));
    },
    async details(placeId) {
      const { fetchPlaceDetails } = await import("@/lib/booking/places-client");
      const sessionToken = crypto.randomUUID();
      return fetchPlaceDetails({ placeId, locale, sessionToken });
    },
  };
}
