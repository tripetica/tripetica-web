export const GPS_ADDRESS_CELL_METERS = 80;

const LAT_METERS = 111_320;
const POI_TYPES = new Set([
  "park",
  "natural_feature",
  "tourist_attraction",
  "airport",
  "museum",
  "point_of_interest",
]);

export type GpsAddressComponent = {
  longName: string;
  types: string[];
};

export type GpsAddressResultSet = {
  types: string[];
  components: GpsAddressComponent[];
};

export function gpsAddressCell(latitude: number, longitude: number) {
  const latStep = GPS_ADDRESS_CELL_METERS / LAT_METERS;
  const cos = Math.cos((latitude * Math.PI) / 180);
  const lonStep = GPS_ADDRESS_CELL_METERS / (LAT_METERS * Math.max(0.2, Math.abs(cos)));
  return `${Math.round(latitude / latStep)}:${Math.round(longitude / lonStep)}`;
}

export function formatGpsAddress(results: GpsAddressResultSet[]) {
  const street = results.find((result) => component(result, "route"));
  if (street) {
    return joinAddress(streetLine(street), areaLine(street, true));
  }
  const poi = results.find((result) => poiName(result));
  if (poi) {
    return joinAddress(poiName(poi), areaLine(poi, false));
  }
  const area = results.find((result) => component(result, "administrative_area_level_2") || component(result, "administrative_area_level_1") || component(result, "administrative_area_level_4"));
  return area ? areaLine(area, true) : null;
}

function streetLine(result: GpsAddressResultSet) {
  const route = shortStreet(component(result, "route") ?? "");
  const number = component(result, "street_number");
  if (!route) return null;
  if (!number) return route;
  const house = /^no\b/i.test(number) ? number.replace(/^no:?\s*/i, "No: ") : `No: ${number}`;
  return `${route} ${house}`;
}

function areaLine(result: GpsAddressResultSet, includeNeighborhood: boolean) {
  const neighborhood = includeNeighborhood ? mahalle(result) : null;
  const district = component(result, "administrative_area_level_2");
  const city = component(result, "administrative_area_level_1");
  const place = [district, city].filter((part): part is string => Boolean(part)).join(" / ");
  return joinAddress(neighborhood, place);
}

function mahalle(result: GpsAddressResultSet) {
  const name = component(result, "neighborhood")
    ?? component(result, "sublocality_level_1")
    ?? component(result, "administrative_area_level_4");
  if (!name) return null;
  if (/mah(alle)?\.?$/i.test(name)) return name;
  return `${name} Mah.`;
}

function poiName(result: GpsAddressResultSet) {
  const named = result.components.find((item) =>
    item.types.some((type) => POI_TYPES.has(type)) && !item.types.includes("political"),
  );
  const name = named?.longName.trim();
  if (!name) return null;
  const neighborhood = component(result, "administrative_area_level_4");
  if (neighborhood && name.localeCompare(neighborhood, "tr") === 0) return null;
  return name;
}

function component(result: GpsAddressResultSet, type: string) {
  const value = result.components.find((item) => item.types.includes(type))?.longName.trim();
  return value || null;
}

function shortStreet(route: string) {
  return route
    .replace(/\bSokağı\b/gi, "Sk.")
    .replace(/\bSokak\b/gi, "Sk.")
    .replace(/\bCaddesi\b/gi, "Cd.")
    .replace(/\bCadde\b/gi, "Cd.")
    .replace(/\bBulvarı\b/gi, "Blv.")
    .replace(/\bBulvar\b/gi, "Blv.")
    .replace(/\s+/g, " ")
    .trim();
}

function joinAddress(left: string | null, right: string | null) {
  const parts = [left, right].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}
