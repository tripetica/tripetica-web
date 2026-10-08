import officialPlaces from "@/lib/uetds/data/official-places.json";

type OfficialPlace = {
  code: string;
  provinceCode: string;
  kind: "district" | "airport";
};

const PLACES = officialPlaces as OfficialPlace[];

export type AtsDistrictRing = ReadonlyArray<readonly [number, number]>;

export type AtsDistrictBoundary = {
  ilKodu: number;
  ilceMernisKodu: number;
  ring: AtsDistrictRing;
};

/** Empty until a boundary set keyed by the ministry district code is installed. */
export const ATS_DISTRICT_BOUNDARIES: readonly AtsDistrictBoundary[] = [];

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

export function resolveAtsDistrict(
  latitude: number,
  longitude: number,
  boundaries: readonly AtsDistrictBoundary[] = ATS_DISTRICT_BOUNDARIES,
): { ok: true; ilKodu: number; ilceMernisKodu: number } | { ok: false; reason: "unresolved" } {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, reason: "unresolved" };
  }
  const hits = boundaries.filter((boundary) =>
    isOfficialAtsDistrict(boundary.ilKodu, boundary.ilceMernisKodu)
    && ringContains(boundary.ring, longitude, latitude),
  );
  if (hits.length !== 1) {
    return { ok: false, reason: "unresolved" };
  }
  const hit = hits[0];
  if (!hit) {
    return { ok: false, reason: "unresolved" };
  }
  return { ok: true, ilKodu: hit.ilKodu, ilceMernisKodu: hit.ilceMernisKodu };
}
