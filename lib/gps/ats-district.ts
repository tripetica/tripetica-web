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
  if (found.size !== 1) {
    return { ok: false, reason: "unresolved" };
  }
  const hit = [...found.values()][0];
  return hit ? { ok: true, ...hit } : { ok: false, reason: "unresolved" };
}
