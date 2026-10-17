import catalogJson from "@/lib/gps/data/ats-district-boundaries.json";
import officialPlaces from "@/lib/uetds/data/official-places.json";

type OfficialPlace = {
  code: string;
  provinceCode: string;
  kind: "district" | "airport";
};

type CatalogFile = {
  boundaries: Array<{
    il: number;
    ilce: number;
    parts: number[][][][];
  }>;
};

const PLACES = officialPlaces as OfficialPlace[];
const CATALOG = catalogJson as CatalogFile;

export type AtsDistrictRing = ReadonlyArray<readonly [number, number]>;

export type AtsDistrictBoundary = {
  ilKodu: number;
  ilceMernisKodu: number;
  parts: ReadonlyArray<ReadonlyArray<AtsDistrictRing>>;
};

type IndexedBoundary = AtsDistrictBoundary & {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

function indexBoundary(boundary: AtsDistrictBoundary): IndexedBoundary {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const part of boundary.parts) {
    for (const ring of part) {
      for (const point of ring) {
        const lon = point[0];
        const lat = point[1];
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return { ...boundary, minLon, minLat, maxLon, maxLat };
}

/**
 * A point this close to exactly one official district edge, and inside no
 * district, is still that district. A point inside two districts stays
 * unresolved: 40.99359, 29.16812 is claimed by both Ataşehir and Ümraniye.
 * A gap of hundreds of metres is not snapped.
 */
export const ATS_DISTRICT_EDGE_M = 30;
const ATS_DISTRICT_EDGE_PAD_DEG = 0.0005;

/**
 * OpenStreetMap admin_level=6 extract from 2020-05-30, matched to official
 * MERNIS district codes. Unmatched districts are absent and stay unresolved.
 * © OpenStreetMap contributors, ODbL-1.0.
 */
export const ATS_DISTRICT_BOUNDARIES: readonly IndexedBoundary[] = CATALOG.boundaries.map((boundary) =>
  indexBoundary({
    ilKodu: boundary.il,
    ilceMernisKodu: boundary.ilce,
    parts: boundary.parts as unknown as AtsDistrictBoundary["parts"],
  }),
);

export function isOfficialAtsDistrict(ilKodu: number, ilceMernisKodu: number) {
  if (!Number.isInteger(ilKodu) || ilKodu < 1 || ilKodu > 81) {
    return false;
  }
  if (!Number.isInteger(ilceMernisKodu) || ilceMernisKodu < 1) {
    return false;
  }
  return PLACES.some((place) =>
    place.kind === "district"
    && place.provinceCode === String(ilKodu)
    && place.code === String(ilceMernisKodu),
  );
}

function ringContains(ring: AtsDistrictRing, longitude: number, latitude: number) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const current = ring[index];
    const prior = ring[previous];
    if (!current || !prior) {
      continue;
    }
    const [xi, yi] = current;
    const [xj, yj] = prior;
    const crosses = (yi > latitude) !== (yj > latitude);
    if (crosses && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function partContains(part: ReadonlyArray<AtsDistrictRing>, longitude: number, latitude: number) {
  const [outer, ...holes] = part;
  if (!outer || !ringContains(outer, longitude, latitude)) {
    return false;
  }
  return !holes.some((hole) => ringContains(hole, longitude, latitude));
}

function segmentDistanceMeters(
  latitude: number,
  longitude: number,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  const cos = Math.cos((latitude * Math.PI) / 180);
  const ax = (from[0] - longitude) * cos * 111_320;
  const ay = (from[1] - latitude) * 110_540;
  const bx = (to[0] - longitude) * cos * 111_320;
  const by = (to[1] - latitude) * 110_540;
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  if (length === 0) return Math.hypot(ax, ay);
  const t = Math.max(0, Math.min(1, (-ax * dx + -ay * dy) / length));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function boundaryEdgeMeters(boundary: AtsDistrictBoundary, latitude: number, longitude: number) {
  let best = Number.POSITIVE_INFINITY;
  for (const part of boundary.parts) {
    for (const ring of part) {
      for (let index = 0; index < ring.length; index += 1) {
        const current = ring[index];
        const next = ring[(index + 1) % ring.length];
        if (!current || !next || (current[0] === next[0] && current[1] === next[1])) continue;
        const distance = segmentDistanceMeters(latitude, longitude, current, next);
        if (distance < best) best = distance;
      }
    }
  }
  return best;
}

function boundaryCanTouch(boundary: AtsDistrictBoundary, latitude: number, longitude: number) {
  const indexed = boundary as IndexedBoundary;
  if (!Number.isFinite(indexed.minLon)) return true;
  return longitude >= indexed.minLon - ATS_DISTRICT_EDGE_PAD_DEG
    && longitude <= indexed.maxLon + ATS_DISTRICT_EDGE_PAD_DEG
    && latitude >= indexed.minLat - ATS_DISTRICT_EDGE_PAD_DEG
    && latitude <= indexed.maxLat + ATS_DISTRICT_EDGE_PAD_DEG;
}

export function resolveAtsDistrict(
  latitude: number,
  longitude: number,
  boundaries: readonly AtsDistrictBoundary[] = ATS_DISTRICT_BOUNDARIES,
): { ok: true; ilKodu: number; ilceMernisKodu: number } | { ok: false; reason: "unresolved" } {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, reason: "unresolved" };
  }
  const found = new Map<string, { ilKodu: number; ilceMernisKodu: number }>();
  for (const boundary of boundaries) {
    if (!isOfficialAtsDistrict(boundary.ilKodu, boundary.ilceMernisKodu)) {
      continue;
    }
    const indexed = boundary as IndexedBoundary;
    if (
      Number.isFinite(indexed.minLon)
      && (lon < indexed.minLon || lon > indexed.maxLon || lat < indexed.minLat || lat > indexed.maxLat)
    ) {
      continue;
    }
    if (!boundary.parts.some((part) => partContains(part, lon, lat))) {
      continue;
    }
    found.set(`${boundary.ilKodu}:${boundary.ilceMernisKodu}`, {
      ilKodu: boundary.ilKodu,
      ilceMernisKodu: boundary.ilceMernisKodu,
    });
  }
  if (found.size > 1) {
    return { ok: false, reason: "unresolved" };
  }
  if (found.size === 1) {
    const hit = [...found.values()][0];
    return hit ? { ok: true, ...hit } : { ok: false, reason: "unresolved" };
  }
  const near = new Map<string, { ilKodu: number; ilceMernisKodu: number }>();
  for (const boundary of boundaries) {
    if (!isOfficialAtsDistrict(boundary.ilKodu, boundary.ilceMernisKodu)) continue;
    if (!boundaryCanTouch(boundary, lat, lon)) continue;
    if (boundaryEdgeMeters(boundary, lat, lon) > ATS_DISTRICT_EDGE_M) continue;
    near.set(`${boundary.ilKodu}:${boundary.ilceMernisKodu}`, {
      ilKodu: boundary.ilKodu,
      ilceMernisKodu: boundary.ilceMernisKodu,
    });
  }
  if (near.size !== 1) {
    return { ok: false, reason: "unresolved" };
  }
  const snapped = [...near.values()][0];
  return snapped ? { ok: true, ...snapped } : { ok: false, reason: "unresolved" };
}
