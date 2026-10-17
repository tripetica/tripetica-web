import { officialUetdsPlaces } from "@/lib/uetds/official-locations";

const NOT_SENT_ERROR = new Set([
  "canlı kimlik yok",
  "test kimliği yok",
  "plaka canlı gönderime kapalı",
  "disabled",
  "no_trip",
  "plate",
  "no_position",
  "offline",
  "gnss_fix",
  "stale_position",
]);

const COORDINATE = /^-?\d+(\.\d+)?$/;

export type AtsHistoryLocationInput = {
  status: string;
  sonucKodu: number | null;
  error: string | null;
  sentLatitude: string | null;
  sentLongitude: string | null;
  sentIlKodu: number | null;
  sentIlceMernisKodu: number | null;
  positionLatitude: string | null;
  positionLongitude: string | null;
};

export type AtsHistoryLocation = {
  place: string | null;
  coordinates: string | null;
};

export function atsHistoryError(status: string, lastError: string | null, sonucMesaji: string | null) {
  if (status === "succeeded") return null;
  const text = (lastError || sonucMesaji || "").trim();
  return text || null;
}

export function atsHistoryLocation(input: AtsHistoryLocationInput): AtsHistoryLocation {
  const sent = coordinatePair(input.sentLatitude, input.sentLongitude);
  const linked = coordinatePair(input.positionLatitude, input.positionLongitude);
  const point = sent ?? (linked && ministryCallUsedPosition(input) ? linked : null);
  if (!point) return { place: null, coordinates: null };
  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { place: null, coordinates: null };
  }
  return {
    place: atsHistoryPlace(sent !== null ? input.sentIlKodu : null, sent !== null ? input.sentIlceMernisKodu : null),
    coordinates: `${point.latitude}, ${point.longitude}`,
  };
}

function ministryCallUsedPosition(input: AtsHistoryLocationInput) {
  if (input.status === "succeeded" || input.sonucKodu !== null) return true;
  if (input.status !== "failed" || !input.error) return false;
  return !NOT_SENT_ERROR.has(input.error);
}

function coordinatePair(latitude: string | null, longitude: string | null) {
  const lat = coordinateText(latitude);
  const lon = coordinateText(longitude);
  if (!lat || !lon) return null;
  return { latitude: lat, longitude: lon };
}

function coordinateText(value: string | null) {
  if (!value) return null;
  const text = value.trim();
  if (!COORDINATE.test(text)) return null;
  return Number.isFinite(Number(text)) ? text : null;
}

function atsHistoryPlace(sentIl: number | null, sentIlce: number | null) {
  if (!Number.isInteger(sentIl) || !Number.isInteger(sentIlce)) return null;
  const place = officialUetdsPlaces().find((item) =>
    item.kind === "district"
    && item.provinceCode === String(sentIl)
    && item.code === String(sentIlce));
  if (!place) return `${sentIl} / ${sentIlce}`;
  return `${place.provinceName} / ${place.name}`;
}
