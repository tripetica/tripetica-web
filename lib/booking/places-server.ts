import {
  parseGoogleAutocomplete,
  parseLegacyAutocomplete,
  type AutocompleteResponse,
  type LegacyAutocompleteResponse,
  type PlaceDetailsValue,
  type PlaceSuggestion,
} from "@/lib/booking/places-parse";
import { type Locale } from "@/lib/i18n/config";

export type PlacesSearchResult = {
  suggestions: PlaceSuggestion[];
  error: string | null;
};

type AddressComponent = {
  longText?: string;
  long_name?: string;
  types?: string[];
};

function placesApiKey(): string {
  const placesKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (placesKey) {
    return placesKey;
  }
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (mapsKey) {
    return mapsKey;
  }
  return "";
}

export async function searchPlaces(input: {
  query: string;
  locale: Locale;
  sessionToken: string;
}): Promise<PlacesSearchResult> {
  const apiKey = placesApiKey();
  if (!apiKey) {
    const error =
      "GOOGLE_PLACES_API_KEY is missing. Add it to .env.local and enable Places API (New).";
    console.error("[Tripetica Places]", error);
    return { suggestions: [], error };
  }

  const newResult = await searchPlacesNew(apiKey, input);
  if (newResult.suggestions.length > 0 || !newResult.error) {
    return newResult;
  }

  console.error("[Tripetica Places] New API failed, trying legacy Autocomplete", newResult.error);
  return searchPlacesLegacy(apiKey, input);
}

async function searchPlacesNew(
  apiKey: string,
  input: { query: string; locale: Locale; sessionToken: string },
): Promise<PlacesSearchResult> {
  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: input.query,
        languageCode: input.locale,
        regionCode: "TR",
        sessionToken: input.sessionToken,
      }),
    },
  );

  let payload: AutocompleteResponse;
  try {
    payload = (await response.json()) as AutocompleteResponse;
  } catch {
    const error = `Places Autocomplete (New) returned a non-JSON response (${response.status})`;
    console.error("[Tripetica Places]", error);
    return { suggestions: [], error };
  }

  if (!response.ok) {
    const error =
      payload.error?.message ??
      `Places Autocomplete (New) HTTP ${response.status}`;
    console.error("[Tripetica Places]", error, payload);
    return { suggestions: [], error };
  }

  return {
    suggestions: parseGoogleAutocomplete(payload),
    error: null,
  };
}

async function searchPlacesLegacy(
  apiKey: string,
  input: { query: string; locale: Locale; sessionToken: string },
): Promise<PlacesSearchResult> {
  const params = new URLSearchParams({
    input: input.query,
    key: apiKey,
    language: input.locale,
    components: "country:tr",
    sessiontoken: input.sessionToken,
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
  );
  const payload = (await response.json()) as LegacyAutocompleteResponse;

  if (!response.ok || (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS")) {
    const error =
      payload.error_message ??
      payload.status ??
      `Places Autocomplete HTTP ${response.status}`;
    console.error("[Tripetica Places]", error, payload);
    return { suggestions: [], error };
  }

  return {
    suggestions: parseLegacyAutocomplete(payload),
    error: null,
  };
}

export async function loadPlaceDetails(input: {
  placeId: string;
  locale: Locale;
  sessionToken: string;
}): Promise<PlaceDetailsValue | null> {
  const apiKey = placesApiKey();
  if (!apiKey) {
    console.error("[Tripetica Places] GOOGLE_PLACES_API_KEY is missing");
    return null;
  }

  const placeId = input.placeId.replace(/^places\//, "");
  const newDetails = await loadPlaceDetailsNew(apiKey, placeId, input);
  if (newDetails) {
    return newDetails;
  }
  return loadPlaceDetailsLegacy(apiKey, placeId, input.locale);
}

async function loadPlaceDetailsNew(
  apiKey: string,
  placeId: string,
  input: { locale: Locale; sessionToken: string },
): Promise<PlaceDetailsValue | null> {
  const params = new URLSearchParams({
    languageCode: input.locale,
    sessionToken: input.sessionToken,
  });
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,addressComponents,types",
      },
    },
  );
  if (!response.ok) {
    const payload = await response.text();
    console.error("[Tripetica Places] Place Details (New) failed", response.status, payload);
    return null;
  }

  const place = (await response.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    addressComponents?: AddressComponent[];
    types?: string[];
  };

  return {
    placeId: place.id ?? placeId,
    name: place.displayName?.text ?? null,
    formattedAddress: place.formattedAddress ?? null,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    city: component(place.addressComponents, "locality"),
    district:
      component(place.addressComponents, "administrative_area_level_2") ??
      component(place.addressComponents, "sublocality") ??
      component(place.addressComponents, "sublocality_level_1"),
    region: component(place.addressComponents, "administrative_area_level_1"),
    country: component(place.addressComponents, "country"),
    types: place.types ?? [],
  };
}

async function loadPlaceDetailsLegacy(
  apiKey: string,
  placeId: string,
  locale: Locale,
): Promise<PlaceDetailsValue | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    language: locale,
    fields: "place_id,name,formatted_address,geometry,address_component,type",
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
  );
  const payload = (await response.json()) as {
    status?: string;
    error_message?: string;
    result?: {
      place_id?: string;
      name?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      address_components?: AddressComponent[];
      types?: string[];
    };
  };

  if (payload.status !== "OK" || !payload.result) {
    console.error("[Tripetica Places] Place Details failed", payload);
    return null;
  }

  const place = payload.result;
  return {
    placeId: place.place_id ?? placeId,
    name: place.name ?? null,
    formattedAddress: place.formatted_address ?? null,
    lat: place.geometry?.location?.lat ?? null,
    lng: place.geometry?.location?.lng ?? null,
    city: component(place.address_components, "locality"),
    district:
      component(place.address_components, "administrative_area_level_2") ??
      component(place.address_components, "sublocality") ??
      component(place.address_components, "sublocality_level_1"),
    region: component(place.address_components, "administrative_area_level_1"),
    country: component(place.address_components, "country"),
    types: place.types ?? [],
  };
}

function component(components: AddressComponent[] | undefined, type: string) {
  const match = components?.find((item) => item.types?.includes(type));
  return match?.longText ?? match?.long_name ?? null;
}
