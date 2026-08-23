export type ServiceType = "transfer" | "hourly" | "tour";

export const BOOKING_SERVICE_EVENT = "tripetica:booking-service";

export type BookingPrefill = {
  service: ServiceType;
  tourId?: TourId;
  pickupAirport?: AirportCode;
};

export function bookingHash(
  service: ServiceType,
  options?: Pick<BookingPrefill, "tourId" | "pickupAirport">,
) {
  if (
    service === "tour" &&
    options?.tourId === "istanbul-layover" &&
    options?.pickupAirport === "IST"
  ) {
    return "#booking-layover";
  }
  if (service === "tour" && options?.tourId === "istanbul-half-day") {
    return "#booking-half-day";
  }
  if (service === "tour" && options?.tourId === "istanbul-full-day") {
    return "#booking-full-day";
  }
  if (service === "tour" && options?.tourId === "bosphorus-dinner") {
    return "#booking-bosphorus-dinner";
  }
  if (service === "tour" && options?.tourId === "sapanca") {
    return "#booking-sapanca";
  }
  if (service === "tour" && options?.tourId === "bursa") {
    return "#booking-bursa";
  }
  if (service === "hourly") {
    return "#booking-hourly";
  }
  if (service === "tour") {
    return "#booking-tour";
  }
  return "#booking";
}

export function prefillFromBookingHash(hash: string): BookingPrefill | null {
  if (hash === "#booking-layover") {
    return {
      service: "tour",
      tourId: "istanbul-layover",
      pickupAirport: "IST",
    };
  }
  if (hash === "#booking-hourly") {
    return { service: "hourly" };
  }
  if (hash === "#booking-half-day") {
    return { service: "tour", tourId: "istanbul-half-day" };
  }
  if (hash === "#booking-full-day") {
    return { service: "tour", tourId: "istanbul-full-day" };
  }
  if (hash === "#booking-bosphorus-dinner") {
    return { service: "tour", tourId: "bosphorus-dinner" };
  }
  if (hash === "#booking-sapanca") {
    return { service: "tour", tourId: "sapanca" };
  }
  if (hash === "#booking-bursa") {
    return { service: "tour", tourId: "bursa" };
  }
  if (hash === "#booking-tour") {
    return { service: "tour" };
  }
  if (hash === "#booking") {
    return { service: "transfer" };
  }
  return null;
}

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
