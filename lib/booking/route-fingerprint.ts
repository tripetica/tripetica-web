export type RouteLatLng = {
  lat: number;
  lng: number;
};

export function roundRouteCoord(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function routeFingerprint(
  origin: RouteLatLng,
  destination: RouteLatLng,
) {
  return [
    roundRouteCoord(origin.lat),
    roundRouteCoord(origin.lng),
    roundRouteCoord(destination.lat),
    roundRouteCoord(destination.lng),
  ].join(",");
}

export function parseLatLngParam(value: string | null): RouteLatLng | null {
  if (!value) {
    return null;
  }
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

export function sameRoutePoint(a: RouteLatLng, b: RouteLatLng) {
  return (
    roundRouteCoord(a.lat) === roundRouteCoord(b.lat) &&
    roundRouteCoord(a.lng) === roundRouteCoord(b.lng)
  );
}

export function payloadMatchesFingerprint(
  payload: { origin: RouteLatLng; destination: RouteLatLng },
  fingerprint: string,
) {
  return routeFingerprint(payload.origin, payload.destination) === fingerprint;
}
