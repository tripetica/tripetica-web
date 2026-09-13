import "server-only";

import { coordsFromLatLng } from "@/lib/booking/route-distance";
import { type Locale } from "@/lib/i18n/config";

type LatLng = {
  lat: number;
  lng: number;
};

const STATIC_MAP_ENDPOINT = "https://maps.googleapis.com/maps/api/staticmap";

function googleApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

function mapLanguage(locale: Locale) {
  if (locale === "ru") {
    return "ru";
  }
  if (locale === "tr") {
    return "tr";
  }
  if (locale === "ar") {
    return "ar";
  }
  return "en";
}

function buildStaticMapUrl(options: {
  origin: LatLng;
  destination: LatLng;
  encodedPolyline: string | null;
  locale: Locale;
  apiKey: string;
}) {
  const params = new URLSearchParams({
    size: "640x200",
    scale: "2",
    maptype: "roadmap",
    language: mapLanguage(options.locale),
    region: "tr",
    key: options.apiKey,
  });
  params.append(
    "markers",
    `color:0x2563eb|label:A|${options.origin.lat},${options.origin.lng}`,
  );
  params.append(
    "markers",
    `color:0x111827|label:B|${options.destination.lat},${options.destination.lng}`,
  );
  return `${STATIC_MAP_ENDPOINT}?${params.toString()}`;
}

let staticMapsUnavailable = false;

export async function fetchGoogleStaticRouteMap(options: {
  origin: LatLng;
  destination: LatLng;
  encodedPolyline: string | null;
  locale: Locale;
}): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (staticMapsUnavailable) {
    return null;
  }

  const apiKey = googleApiKey();
  if (!apiKey) {
    console.error("[Tripetica map] Google API key is missing");
    return null;
  }

  const url = buildStaticMapUrl({
    ...options,
    encodedPolyline: null,
    apiKey,
  });

  const response = await fetch(url);
  const contentType = response.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!response.ok || !contentType.startsWith("image/") || bytes.length < 32) {
    const detail = new TextDecoder().decode(bytes.slice(0, 400)).replace(/\s+/g, " ").trim();
    console.warn(
      "[Tripetica map] Static Maps rejected",
      response.status,
      contentType || "no-content-type",
      detail || "empty body",
    );
    staticMapsUnavailable = true;
    return null;
  }

  return { bytes, contentType };
}

export function routePointsFromDraft(pickup: {
  latitude: number | null;
  longitude: number | null;
}, dropoff: {
  latitude: number | null;
  longitude: number | null;
}) {
  return {
    origin: coordsFromLatLng(pickup.latitude, pickup.longitude),
    destination: coordsFromLatLng(dropoff.latitude, dropoff.longitude),
  };
}
