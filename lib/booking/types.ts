export type ServiceType = "transfer" | "hourly" | "tour";

export type TourBehavior = "vehicleBooking" | "perPersonBooking" | "customQuote";

export type LocationSource = "preset" | "google" | "query";

export type LocationKind = "airport" | "place" | null;

export type LocationValue = {
  source: LocationSource;
  name: string;
  formattedAddress: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  district: string | null;
  region: string | null;
  country: string | null;
  airportCode: string | null;
  type: LocationKind;
  placeTypes: string[] | null;
};

export type BookingDateTime = {
  timeZone: "Europe/Istanbul";
  local: string;
};

export type AirportCode = "IST" | "SAW" | "AYT";

export type AirportPreset = {
  id: AirportCode;
  airportCode: AirportCode;
  type: "airport";
  source: "preset";
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  formattedAddress: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  country: string | null;
};

export type DurationOption = {
  hours: number;
  includedKm: number;
};

export type TourId =
  | "istanbul-layover"
  | "istanbul-half-day"
  | "istanbul-full-day"
  | "sapanca"
  | "bursa"
  | "bosphorus-dinner"
  | "cappadocia"
  | "pamukkale"
  | "ephesus"
  | "gobeklitepe"
  | "custom";

export type TourOption = {
  id: TourId;
  behaviorType: TourBehavior;
};

export function emptyLocation(): LocationValue {
  return {
    source: "query",
    name: "",
    formattedAddress: null,
    placeId: null,
    lat: null,
    lng: null,
    city: null,
    district: null,
    region: null,
    country: null,
    airportCode: null,
    type: null,
    placeTypes: null,
  };
}

export function isLocationFilled(value: LocationValue | null) {
  if (!value) {
    return false;
  }
  return value.name.trim().length > 0 || Boolean(value.placeId);
}
