import {
  type AirportCode,
  type AirportPreset,
  type DurationOption,
  type LocationValue,
  type TourOption,
} from "./types";
import { type Locale } from "@/lib/i18n/config";

export const durationOptions: DurationOption[] = [
  { hours: 5, includedKm: 60 },
  { hours: 6, includedKm: 70 },
  { hours: 7, includedKm: 80 },
  { hours: 8, includedKm: 90 },
  { hours: 9, includedKm: 100 },
  { hours: 10, includedKm: 110 },
  { hours: 11, includedKm: 120 },
  { hours: 12, includedKm: 130 },
  { hours: 13, includedKm: 140 },
  { hours: 14, includedKm: 150 },
  { hours: 15, includedKm: 160 },
  { hours: 16, includedKm: 170 },
  { hours: 17, includedKm: 180 },
  { hours: 18, includedKm: 190 },
  { hours: 19, includedKm: 200 },
  { hours: 20, includedKm: 220 },
];

export function formatDurationOption(
  option: DurationOption,
  locale: Locale,
) {
  if (locale === "ru") {
    return `${option.hours} часов (${option.includedKm} км)`;
  }
  if (locale === "tr") {
    return `${option.hours} saat (${option.includedKm} km)`;
  }
  return `${option.hours} Hours (${option.includedKm} km)`;
}

export const tourOptions: TourOption[] = [
  { id: "istanbul-layover", behaviorType: "customQuote" },
  { id: "istanbul-half-day", behaviorType: "vehicleBooking" },
  { id: "istanbul-full-day", behaviorType: "vehicleBooking" },
  { id: "sapanca", behaviorType: "vehicleBooking" },
  { id: "bursa", behaviorType: "vehicleBooking" },
  { id: "bosphorus-dinner", behaviorType: "perPersonBooking" },
  { id: "cappadocia", behaviorType: "customQuote" },
  { id: "pamukkale", behaviorType: "customQuote" },
  { id: "ephesus", behaviorType: "customQuote" },
  { id: "gobeklitepe", behaviorType: "customQuote" },
  { id: "custom", behaviorType: "customQuote" },
];

/**
 * Canonical airport presets verified via Places API (New) Place Details.
 * Technical identity (placeId / lat / lng / airport_code) is locale-independent.
 * Localized display names stay in booking copy, not here.
 */
export const airportPresets: AirportPreset[] = [
  {
    id: "IST",
    airportCode: "IST",
    type: "airport",
    source: "preset",
    placeId: "ChIJqZW8Cvb_n0ARBuUkyCzgDDg",
    lat: 41.2761476,
    lng: 28.7287349,
    googleName: "Istanbul Airport",
    formattedAddress:
      "Tayakadın, Terminal Caddesi No:1, 34283 Arnavutköy/İstanbul, Türkiye",
    city: "İstanbul",
    district: "Arnavutköy",
    region: "İstanbul",
    country: "Türkiye",
  },
  {
    id: "SAW",
    airportCode: "SAW",
    type: "airport",
    source: "preset",
    placeId: "ChIJU6Ek9MvbyhQRdNqYgE3K76w",
    lat: 40.8944747,
    lng: 29.3130928,
    googleName: "Sabiha Gökçen International Airport",
    formattedAddress: "Sanayi, 34906 Pendik/İstanbul, Türkiye",
    city: "İstanbul",
    district: "Pendik",
    region: "İstanbul",
    country: "Türkiye",
  },
  {
    id: "AYT",
    airportCode: "AYT",
    type: "airport",
    source: "preset",
    placeId: "ChIJnXxhjXeEwxQR-uhI2_zcfME",
    lat: 36.9086961,
    lng: 30.7981855,
    googleName: "Antalya Airport",
    formattedAddress:
      "Yeşilköy, Antalya Havaalanı, 07230 Muratpaşa/Antalya, Türkiye",
    city: "Antalya",
    district: "Muratpaşa",
    region: "Antalya",
    country: "Türkiye",
  },
];

export function airportPresetByCode(code: AirportCode) {
  const preset = airportPresets.find((item) => item.id === code);
  if (!preset) {
    throw new Error(`Unknown airport preset: ${code}`);
  }
  return preset;
}

export function locationFromAirportPreset(
  preset: AirportPreset,
  label: string,
): LocationValue {
  return {
    source: "preset",
    name: label,
    formattedAddress: preset.formattedAddress,
    placeId: preset.placeId,
    lat: preset.lat,
    lng: preset.lng,
    city: preset.city,
    district: preset.district,
    region: preset.region,
    country: preset.country,
    countryCode: "TR",
    airportCode: preset.airportCode,
    type: "airport",
    placeTypes: ["airport"],
  };
}
