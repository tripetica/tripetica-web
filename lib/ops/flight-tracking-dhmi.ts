import "server-only";

import {
  dhmiAirportPathId,
  FALLBACK_DHMI_AIRPORT_IDS,
  type DhmiFlightCandidate,
} from "@/lib/ops/flight-tracking";

const UCUSIZLE_BASE = "https://ucusizle.dhmi.gov.tr";
const FLIGHTWEBSVC_BASE = "https://flightwebsvc.dhmi.gov.tr";
const ALLFLIGHTS_PAGE =
  "https://www.dhmi.gov.tr/Sayfalar/AllFlights.aspx";
const FETCH_TIMEOUT_MS = 8000;
const TOKEN_TTL_MS = 10 * 60 * 1000;
const AIRPORT_TTL_MS = 60 * 60 * 1000;
const BOARD_TTL_MS = 60 * 1000;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; TripeticaFlightTrack/1.0; +https://tripetica.com)",
  Accept: "application/json,text/html;q=0.9",
};

type Cached<T> = { value: T; expiresAt: number };

let tokenCache: Cached<string> | null = null;
let airportCache: Cached<Map<string, number>> | null = null;
const boardCache = new Map<string, Cached<DhmiFlightCandidate[]>>();
const inFlightBoards = new Map<string, Promise<DhmiFlightCandidate[]>>();

export type DhmiFetchResult =
  | { ok: true; flights: DhmiFlightCandidate[] }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function decodeWrappedJson(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) {
    return payload;
  }
  const data = record.data;
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) {
      return [];
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error("unexpected_dhmi_payload");
    }
  }
  return data ?? payload;
}

export function parseUcusizleAirports(payload: unknown): Map<string, number> {
  const rows = decodeWrappedJson(payload);
  const map = new Map<string, number>(Object.entries(FALLBACK_DHMI_AIRPORT_IDS));
  if (!Array.isArray(rows)) {
    return map;
  }
  for (const row of rows) {
    const item = asRecord(row);
    if (!item) {
      continue;
    }
    const id = asNumber(item.airportId ?? item.Id);
    const iata = asString(item.iataCode ?? item.Iata ?? item.Code).trim().toUpperCase();
    if (id && iata.length === 3) {
      map.set(iata, id);
    }
  }
  return map;
}

export function parseUcusizleFlights(payload: unknown): DhmiFlightCandidate[] {
  const rows = decodeWrappedJson(payload);
  if (!Array.isArray(rows)) {
    throw new Error("unexpected_dhmi_payload");
  }
  const flights: DhmiFlightCandidate[] = [];
  for (const row of rows) {
    const item = asRecord(row);
    if (!item) {
      continue;
    }
    const number = asString(item.flightCode ?? item.Number).trim();
    if (!number) {
      continue;
    }
    flights.push({
      number,
      date: asString(item.flightDate ?? item.Date),
      planned: asString(item.scheduledTime ?? item.Planned),
      estimated: asString(item.estimatedTime ?? item.Estimated),
      exactTime: asString(item.exactTime) || null,
      status: asString(item.flightStatus ?? item.Status),
      statusId: asNumber(item.flightStatusId),
      scheduledDateTime: asString(item.scheduledTime) || null,
      estimatedDateTime: asString(item.estimatedTime) || null,
    });
  }
  return flights;
}

export function parseAllFlightsList(payload: unknown): DhmiFlightCandidate[] {
  if (!Array.isArray(payload)) {
    throw new Error("unexpected_dhmi_payload");
  }
  const flights: DhmiFlightCandidate[] = [];
  for (const row of payload) {
    const item = asRecord(row);
    if (!item) {
      continue;
    }
    const number = asString(item.Number).trim();
    if (!number) {
      continue;
    }
    flights.push({
      number,
      date: asString(item.Date),
      planned: asString(item.Planned),
      estimated: asString(item.Estimated),
      exactTime: null,
      status: asString(item.Status),
      statusId: null,
    });
  }
  return flights;
}

export function mergeDhmiBoards(
  primary: DhmiFlightCandidate[],
  fallback: DhmiFlightCandidate[],
): DhmiFlightCandidate[] {
  const merged = new Map<string, DhmiFlightCandidate>();
  const keyOf = (flight: DhmiFlightCandidate) =>
    `${flight.number.toUpperCase()}|${flight.date}|${flight.planned}`;
  for (const flight of fallback) {
    merged.set(keyOf(flight), { ...flight, exactTime: flight.exactTime || null });
  }
  for (const flight of primary) {
    const key = keyOf(flight);
    const previous = merged.get(key);
    merged.set(key, {
      ...previous,
      ...flight,
      exactTime: flight.exactTime || previous?.exactTime || null,
      scheduledDateTime: flight.scheduledDateTime || previous?.scheduledDateTime || null,
      estimatedDateTime: flight.estimatedDateTime || previous?.estimatedDateTime || null,
      statusId: flight.statusId ?? previous?.statusId ?? null,
    });
  }
  return [...merged.values()];
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`dhmi_http_${response.status}`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("unexpected_dhmi_payload");
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`dhmi_http_${response.status}`);
  }
  return response.text();
}

export function extractAllFlightsToken(html: string): string | null {
  const match = html.match(/id="Ktoken"\s+value="([^"]+)"/i);
  const token = match?.[1]?.trim() ?? "";
  return token || null;
}

async function loadKToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.value;
  }
  const html = await fetchText(ALLFLIGHTS_PAGE);
  const token = extractAllFlightsToken(html);
  if (!token) {
    throw new Error("dhmi_token_missing");
  }
  tokenCache = { value: token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

async function loadAirportMap(): Promise<Map<string, number>> {
  if (airportCache && airportCache.expiresAt > Date.now()) {
    return airportCache.value;
  }
  try {
    const payload = await fetchJson(`${UCUSIZLE_BASE}/api/airport/all`, {
      ...BROWSER_HEADERS,
      Referer: `${UCUSIZLE_BASE}/`,
    });
    const map = parseUcusizleAirports(payload);
    airportCache = { value: map, expiresAt: Date.now() + AIRPORT_TTL_MS };
    return map;
  } catch {
    const fallback = new Map<string, number>(Object.entries(FALLBACK_DHMI_AIRPORT_IDS));
    airportCache = { value: fallback, expiresAt: Date.now() + 5 * 60 * 1000 };
    return fallback;
  }
}

export async function resolveDhmiAirportId(iataCode: string): Promise<number | null> {
  const code = iataCode.trim().toUpperCase();
  if (!code) {
    return null;
  }
  const map = await loadAirportMap();
  return map.get(code) ?? FALLBACK_DHMI_AIRPORT_IDS[code] ?? null;
}

async function fetchUcusizleArrivals(airportId: number): Promise<DhmiFlightCandidate[]> {
  const pathId = dhmiAirportPathId(airportId);
  const boards = await Promise.all(
    ["D/A", "I/A"].map((rest) =>
      fetchJson(`${UCUSIZLE_BASE}/api/airport/${pathId}/${rest}`, {
        ...BROWSER_HEADERS,
        Referer: `${UCUSIZLE_BASE}/`,
      }).then(parseUcusizleFlights, () => [] as DhmiFlightCandidate[]),
    ),
  );
  return boards.flat();
}

async function fetchAllFlightsArrivals(airportId: number): Promise<DhmiFlightCandidate[]> {
  const token = await loadKToken();
  const boards = await Promise.all(
    ["DA/D", "DA/I"].map((rest) =>
      fetchJson(`${FLIGHTWEBSVC_BASE}/api/Flights/${airportId}/${rest}`, {
        ...BROWSER_HEADERS,
        Accept: "application/json",
        KToken: token,
        Referer: ALLFLIGHTS_PAGE,
      }).then(parseAllFlightsList),
    ),
  );
  return boards.flat();
}

async function loadAirportBoardUncached(airportId: number): Promise<DhmiFlightCandidate[]> {
  const ucusizle = await fetchUcusizleArrivals(airportId).catch(() => [] as DhmiFlightCandidate[]);
  let allFlights: DhmiFlightCandidate[] = [];
  let allFlightsError: string | null = null;
  try {
    allFlights = await fetchAllFlightsArrivals(airportId);
  } catch (error) {
    allFlightsError = error instanceof Error ? error.message : "dhmi_unavailable";
  }
  const merged = mergeDhmiBoards(ucusizle, allFlights);
  if (merged.length === 0 && allFlightsError && ucusizle.length === 0) {
    throw new Error(allFlightsError);
  }
  return merged;
}

export async function loadDhmiArrivals(airportId: number): Promise<DhmiFetchResult> {
  const cacheKey = String(airportId);
  const cached = boardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, flights: cached.value };
  }
  const pending = inFlightBoards.get(cacheKey);
  if (pending) {
    try {
      return { ok: true, flights: await pending };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "dhmi_unavailable",
      };
    }
  }
  const request = loadAirportBoardUncached(airportId);
  inFlightBoards.set(cacheKey, request);
  try {
    const flights = await request;
    boardCache.set(cacheKey, { value: flights, expiresAt: Date.now() + BOARD_TTL_MS });
    return { ok: true, flights };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "dhmi_unavailable",
    };
  } finally {
    inFlightBoards.delete(cacheKey);
  }
}

export function clearDhmiCachesForTests() {
  tokenCache = null;
  airportCache = null;
  boardCache.clear();
  inFlightBoards.clear();
}
