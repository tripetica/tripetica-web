import { formatGpsAddress, gpsAddressCell, type GpsAddressResultSet } from "@/lib/gps/address-format";

export type GpsAddressResult = {
  status: "ok" | "unavailable";
  address: string | null;
};

type CacheEntry = {
  expiresAt: number;
  result: GpsAddressResult;
};

type GoogleComponent = {
  long_name?: string;
  types?: string[];
};

type GoogleResult = {
  types?: string[];
  address_components?: GoogleComponent[];
};

const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 2 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<GpsAddressResult>>();

export function parseGpsAddressQuery(latRaw: string | null, lonRaw: string | null) {
  const latitude = Number(latRaw);
  const longitude = Number(lonRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

export function clearGpsAddressCache() {
  cache.clear();
  inflight.clear();
}

export function gpsAddressCacheSize() {
  return cache.size;
}

export async function lookupGpsAddress(
  latitude: number,
  longitude: number,
  now = Date.now(),
  resolve: (latitude: number, longitude: number) => Promise<GpsAddressResult> = resolveGpsAddress,
) {
  const key = gpsAddressCell(latitude, longitude);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }
  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }
  const job = resolve(latitude, longitude)
    .catch(() => ({ status: "unavailable", address: null }) satisfies GpsAddressResult)
    .then((result) => {
      cache.set(key, {
        expiresAt: Date.now() + (result.status === "ok" ? SUCCESS_TTL_MS : FAILURE_TTL_MS),
        result,
      });
      if (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      inflight.delete(key);
      return result;
    });
  inflight.set(key, job);
  return job;
}

export async function resolveGpsAddress(latitude: number, longitude: number): Promise<GpsAddressResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
  if (!apiKey) {
    return { status: "unavailable", address: null };
  }
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${latitude},${longitude}`);
    url.searchParams.set("language", "tr");
    url.searchParams.set("key", apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) {
      return { status: "unavailable", address: null };
    }
    const body = await response.json() as { status?: string; results?: GoogleResult[] };
    if (body.status === "ZERO_RESULTS") {
      return { status: "ok", address: null };
    }
    if (body.status !== "OK" || !Array.isArray(body.results)) {
      return { status: "unavailable", address: null };
    }
    return { status: "ok", address: formatGpsAddress(mapResults(body.results)) };
  } catch {
    return { status: "unavailable", address: null };
  }
}

function mapResults(results: GoogleResult[]): GpsAddressResultSet[] {
  return results.map((result) => ({
    types: result.types ?? [],
    components: (result.address_components ?? [])
      .map((component) => ({
        longName: component.long_name?.trim() ?? "",
        types: component.types ?? [],
      }))
      .filter((component) => component.longName.length > 0),
  }));
}
