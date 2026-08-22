import { type Locale } from "@/lib/i18n/config";
import { type PlaceSuggestion } from "@/lib/booking/places-parse";
import { type PlaceDetailsValue } from "@/lib/booking/places-parse";

export type PlacesClientResult = {
  suggestions: PlaceSuggestion[];
  error: string | null;
};

export async function fetchPlaceSuggestions(input: {
  query: string;
  locale: Locale;
  sessionToken: string;
}): Promise<PlacesClientResult> {
  const response = await fetch("/api/places/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as PlacesClientResult;

  if (!response.ok) {
    const error = payload.error ?? `Places request failed (${response.status})`;
    console.error("[Tripetica Places]", error);
    return { suggestions: [], error };
  }

  if (payload.error) {
    console.error("[Tripetica Places]", payload.error);
  }

  return {
    suggestions: payload.suggestions ?? [],
    error: payload.error ?? null,
  };
}

export async function fetchPlaceDetails(input: {
  placeId: string;
  locale: Locale;
  sessionToken: string;
}) {
  const response = await fetch("/api/places/details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    console.error("[Tripetica Places] details failed", response.status);
    return null;
  }

  return (await response.json()) as PlaceDetailsValue | null;
}
