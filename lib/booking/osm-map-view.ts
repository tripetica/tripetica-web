export type MapLatLng = {
  lat: number;
  lng: number;
};

const TILE_SIZE = 256;

export function decodePolyline(encoded: string, precision = 5): MapLatLng[] {
  const coordinates: MapLatLng[] = [];
  const factor = 10 ** precision;
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ lat: lat / factor, lng: lng / factor });
  }

  return coordinates;
}

function lngToTileX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat: number, zoom: number) {
  const clamped = Math.min(85.05112878, Math.max(-85.05112878, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 2 ** zoom;
}

function project(point: MapLatLng, zoom: number) {
  return {
    x: lngToTileX(point.lng, zoom) * TILE_SIZE,
    y: latToTileY(point.lat, zoom) * TILE_SIZE,
  };
}

function boundsOf(points: MapLatLng[]) {
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

export type OsmMapView = {
  zoom: number;
  origin: { x: number; y: number };
  width: number;
  height: number;
  tiles: Array<{ key: string; url: string; left: number; top: number }>;
  originPx: { x: number; y: number };
  destinationPx: { x: number; y: number };
  path: string | null;
};

export function buildOsmMapView(options: {
  origin: MapLatLng;
  destination: MapLatLng;
  width: number;
  height: number;
}): OsmMapView {
  const width = Math.max(160, Math.round(options.width));
  const height = Math.max(120, Math.round(options.height));
  const points = [options.origin, options.destination];
  const bounds = boundsOf(points);
  const padding = 36;
  const closeTogether =
    Math.abs(options.origin.lat - options.destination.lat) < 0.0008 &&
    Math.abs(options.origin.lng - options.destination.lng) < 0.0008;
  const maxZoom = closeTogether ? 13 : 16;

  let zoom = Math.min(15, maxZoom);
  for (let candidate = maxZoom; candidate >= 4; candidate -= 1) {
    const northWest = project({ lat: bounds.maxLat, lng: bounds.minLng }, candidate);
    const southEast = project({ lat: bounds.minLat, lng: bounds.maxLng }, candidate);
    const spanX = Math.max(1, southEast.x - northWest.x);
    const spanY = Math.max(1, southEast.y - northWest.y);
    if (spanX + padding * 2 <= width && spanY + padding * 2 <= height) {
      zoom = candidate;
      break;
    }
    zoom = candidate;
  }

  const northWest = project({ lat: bounds.maxLat, lng: bounds.minLng }, zoom);
  const southEast = project({ lat: bounds.minLat, lng: bounds.maxLng }, zoom);
  const spanX = Math.max(1, southEast.x - northWest.x);
  const spanY = Math.max(1, southEast.y - northWest.y);
  const originX = northWest.x - (width - spanX) / 2;
  const originY = northWest.y - (height - spanY) / 2;

  const minTileX = Math.floor(originX / TILE_SIZE);
  const maxTileX = Math.floor((originX + width) / TILE_SIZE);
  const minTileY = Math.floor(originY / TILE_SIZE);
  const maxTileY = Math.floor((originY + height) / TILE_SIZE);
  const tileLimit = 2 ** zoom;
  const tiles: OsmMapView["tiles"] = [];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      if (y < 0 || y >= tileLimit) {
        continue;
      }
      const wrappedX = ((x % tileLimit) + tileLimit) % tileLimit;
      tiles.push({
        key: `${zoom}/${wrappedX}/${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: x * TILE_SIZE - originX,
        top: y * TILE_SIZE - originY,
      });
    }
  }

  const originWorld = project(options.origin, zoom);
  const destinationWorld = project(options.destination, zoom);

  return {
    zoom,
    origin: { x: originX, y: originY },
    width,
    height,
    tiles,
    originPx: { x: originWorld.x - originX, y: originWorld.y - originY },
    destinationPx: {
      x: destinationWorld.x - originX,
      y: destinationWorld.y - originY,
    },
    path: null,
  };
}
