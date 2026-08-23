import {
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
 * Airport presets for the location selector.
 * placeId / lat / lng / formattedAddress stay null until verified
 * Google Place details are supplied — do not invent coordinates or IDs.
 */
export const airportPresets: AirportPreset[] = [
  {
    id: "IST",
    airportCode: "IST",
    type: "airport",
    source: "preset",
    placeId: null, // TODO: Google Place ID
    lat: null, // TODO: verified latitude
    lng: null, // TODO: verified longitude
    formattedAddress: null, // TODO: official formatted address
    city: "Istanbul",
    district: "Arnavutköy",
    region: "Istanbul",
    country: "Turkey",
  },
  {
    id: "SAW",
    airportCode: "SAW",
    type: "airport",
    source: "preset",
    placeId: null, // TODO: Google Place ID
    lat: null, // TODO: verified latitude
    lng: null, // TODO: verified longitude
    formattedAddress: null, // TODO: official formatted address
    city: "Istanbul",
    district: "Pendik",
    region: "Istanbul",
    country: "Turkey",
  },
  {
    id: "AYT",
    airportCode: "AYT",
    type: "airport",
    source: "preset",
    placeId: null, // TODO: Google Place ID
    lat: null, // TODO: verified latitude
    lng: null, // TODO: verified longitude
    formattedAddress: null, // TODO: official formatted address
    city: "Antalya",
    district: "Aksu",
    region: "Antalya",
    country: "Turkey",
  },
];

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
    airportCode: preset.airportCode,
    type: "airport",
    placeTypes: ["airport"],
  };
}
