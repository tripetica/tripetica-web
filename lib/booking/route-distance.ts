import "server-only";

type LatLng = {
  lat: number;
  lng: number;
};

export type DrivingRoute = {
  distanceKm: number;
  durationSeconds: number | null;
  encodedPolyline: string | null;
};

type RoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }>;
};

type DistanceMatrixResponse = {
  status?: string;
  rows?: Array<{
    elements?: Array<{
      status?: string;
      distance?: { value?: number };
      duration?: { value?: number };
    }>;
  }>;
};

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: string;
  }>;
};

function googleApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

export function coordsFromLatLng(
  lat: number | null | undefined,
  lng: number | null | undefined,
): LatLng | null {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return { lat, lng };
}

export function roundDistanceKm(km: number) {
  return Math.round(km * 10) / 10;
}

function routeCacheKey(origin: LatLng, destination: LatLng) {
  return `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}|${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;
}

const routeCache = new Map<string, DrivingRoute>();

function rememberRoute(origin: LatLng, destination: LatLng, route: DrivingRoute) {
  routeCache.set(routeCacheKey(origin, destination), route);
}

export function peekDrivingRoute(origin: LatLng, destination: LatLng) {
  return routeCache.get(routeCacheKey(origin, destination)) ?? null;
}

function parseGoogleDuration(value: string | undefined) {
  if (!value) {
    return null;
  }
  const match = value.match(/^(\d+(?:\.\d+)?)s$/);
  if (!match) {
    return null;
  }
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.round(seconds) : null;
}

function asRoute(
  meters: number | undefined,
  durationSeconds: number | null,
  encodedPolyline: string | null,
): DrivingRoute | null {
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) {
    return null;
  }
  return {
    distanceKm: roundDistanceKm(meters / 1000),
    durationSeconds,
    encodedPolyline: encodedPolyline?.trim() ? encodedPolyline : null,
  };
}

async function routeFromRoutesApi(
  origin: LatLng,
  destination: LatLng,
  apiKey: string,
  fieldMask: string,
) {
  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: { latitude: origin.lat, longitude: origin.lng },
          },
        },
        destination: {
          location: {
            latLng: { latitude: destination.lat, longitude: destination.lng },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        regionCode: "TR",
      }),
    },
  );

  if (!response.ok) {
    console.error("[Tripetica distance] Routes HTTP", response.status);
    return null;
  }

  const payload = (await response.json()) as RoutesResponse;
  const route = payload.routes?.[0];
  return asRoute(
    route?.distanceMeters,
    parseGoogleDuration(route?.duration),
    route?.polyline?.encodedPolyline ?? null,
  );
}

async function routeFromMatrixApi(origin: LatLng, destination: LatLng, apiKey: string) {
  const params = new URLSearchParams({
    origins: `${origin.lat},${origin.lng}`,
    destinations: `${destination.lat},${destination.lng}`,
    mode: "driving",
    region: "tr",
    key: apiKey,
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
  );

  if (!response.ok) {
    console.error("[Tripetica distance] Matrix HTTP", response.status);
    return null;
  }

  const payload = (await response.json()) as DistanceMatrixResponse;
  if (payload.status && payload.status !== "OK") {
    console.error("[Tripetica distance] Matrix status", payload.status);
    return null;
  }
  const element = payload.rows?.[0]?.elements?.[0];
  if (element?.status && element.status !== "OK") {
    console.error("[Tripetica distance] Matrix element", element.status);
    return null;
  }
  const duration =
    typeof element?.duration?.value === "number" ? Math.round(element.duration.value) : null;
  return asRoute(element?.distance?.value, duration, null);
}

async function routeFromOsrm(origin: LatLng, destination: LatLng) {
  const path = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=polyline`,
  );
  if (!response.ok) {
    console.error("[Tripetica distance] OSRM HTTP", response.status);
    return null;
  }
  const payload = (await response.json()) as OsrmResponse;
  if (payload.code && payload.code !== "Ok") {
    console.error("[Tripetica distance] OSRM code", payload.code);
    return null;
  }
  const route = payload.routes?.[0];
  const duration =
    typeof route?.duration === "number" ? Math.round(route.duration) : null;
  const polyline = typeof route?.geometry === "string" ? route.geometry : null;
  return asRoute(route?.distance, duration, polyline);
}

export async function computeDrivingRoute(
  origin: LatLng | null,
  destination: LatLng | null,
): Promise<DrivingRoute | null> {
  if (!origin || !destination) {
    return null;
  }

  const cached = peekDrivingRoute(origin, destination);
  if (cached) {
    return cached;
  }

  const apiKey = googleApiKey();
  if (apiKey) {
    try {
      const fromRoutes =
        (await routeFromRoutesApi(
          origin,
          destination,
          apiKey,
          "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
        )) ??
        (await routeFromRoutesApi(origin, destination, apiKey, "routes.distanceMeters"));
      if (fromRoutes) {
        rememberRoute(origin, destination, fromRoutes);
        return fromRoutes;
      }
    } catch (error) {
      console.error("[Tripetica distance] Routes failed");
      void error;
    }

    try {
      const fromMatrix = await routeFromMatrixApi(origin, destination, apiKey);
      if (fromMatrix) {
        rememberRoute(origin, destination, fromMatrix);
        return fromMatrix;
      }
    } catch (error) {
      console.error("[Tripetica distance] Matrix failed");
      void error;
    }
  } else {
    console.error("[Tripetica distance] Google API key is missing");
  }

  try {
    const fromOsrm = await routeFromOsrm(origin, destination);
    if (fromOsrm) {
      rememberRoute(origin, destination, fromOsrm);
    }
    return fromOsrm;
  } catch (error) {
    console.error("[Tripetica distance] OSRM failed");
    void error;
    return null;
  }
}

export async function computeDrivingDistanceKm(
  origin: LatLng | null,
  destination: LatLng | null,
): Promise<number | null> {
  const route = await computeDrivingRoute(origin, destination);
  return route?.distanceKm ?? null;
}
