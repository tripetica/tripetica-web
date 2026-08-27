export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  types: string[];
};

export type PlaceDetailsValue = {
  placeId: string | null;
  name: string | null;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  district: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  types: string[];
};

export type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      place?: string;
      placeId?: string;
      types?: string[];
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      text?: { text?: string };
    };
  }>;
  error?: { message?: string; status?: string };
};

export type LegacyAutocompleteResponse = {
  status?: string;
  error_message?: string;
  predictions?: Array<{
    place_id?: string;
    types?: string[];
    description?: string;
    structured_formatting?: {
      main_text?: string;
      secondary_text?: string;
    };
  }>;
};

export function parseGoogleAutocomplete(
  payload: AutocompleteResponse,
): PlaceSuggestion[] {
  return (payload.suggestions ?? [])
    .map((suggestion) => {
      const prediction = suggestion.placePrediction;
      const placeId =
        prediction?.placeId ?? prediction?.place?.replace(/^places\//, "");
      if (!prediction || !placeId) {
        return null;
      }
      return {
        placeId,
        primaryText:
          prediction.structuredFormat?.mainText?.text ??
          prediction.text?.text ??
          "",
        secondaryText: prediction.structuredFormat?.secondaryText?.text ?? "",
        types: prediction.types ?? [],
      };
    })
    .filter((item): item is PlaceSuggestion => Boolean(item?.primaryText));
}

export function parseLegacyAutocomplete(
  payload: LegacyAutocompleteResponse,
): PlaceSuggestion[] {
  return (payload.predictions ?? [])
    .map((prediction) => {
      if (!prediction.place_id) {
        return null;
      }
      return {
        placeId: prediction.place_id,
        primaryText:
          prediction.structured_formatting?.main_text ??
          prediction.description ??
          "",
        secondaryText: prediction.structured_formatting?.secondary_text ?? "",
        types: prediction.types ?? [],
      };
    })
    .filter((item): item is PlaceSuggestion => Boolean(item?.primaryText));
}
