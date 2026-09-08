import {
  HOURLY_MAX_HOURS,
  HOURLY_MIN_HOURS,
  HOURLY_SERVICE_TYPE,
} from "@/lib/booking/pricing/hourly-pricing";
import { layoverAirportCodeFromLocation } from "@/lib/booking/layover-airports";
import {
  LAYOVER_PACKAGE_HOURS,
  LAYOVER_TOUR_CODE,
  TOUR_SERVICE_TYPE,
} from "@/lib/booking/pricing/layover-pricing";
import {
  HALF_DAY_TOUR_CODE,
  FULL_DAY_TOUR_CODE,
} from "@/lib/booking/pricing/istanbul-address-package-tour";
import {
  noKmPackageTourDurationHours,
} from "@/lib/booking/pricing/no-km-package-tour";
import { BURSA_TOUR_CODE } from "@/lib/booking/pricing/bursa-pricing";
import {
  BOSPHORUS_DINNER_TOUR_CODE,
  bosphorusLocalDateTimeFromDate,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { SAPANCA_TOUR_CODE } from "@/lib/booking/pricing/sapanca-pricing";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { isIstanbulLocationValue } from "@/lib/booking/istanbul-location";
import { toPersistedLocation } from "@/lib/booking/location-persist";
import {
  emptyLocation,
  isLocationFilled,
  type LocationValue,
  type TourId,
} from "@/lib/booking/types";
import { isLocale, type Locale } from "@/lib/i18n/config";

export type TransferSearchInputError = {
  status: 400;
  message: string;
};

export type ParsedTransferSearchInput = {
  locale: Locale;
  serviceType: "transfer" | "hourly" | "tour";
  tourCode: string | null;
  pickup: LocationValue;
  dropoff: LocationValue;
  pickupAt: Date;
  distanceKm: number | null;
  durationHours: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNullableNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length > 0 ? items : null;
}

function parseLocation(value: unknown): LocationValue | null {
  if (!isRecord(value)) {
    return null;
  }
  const source =
    value.source === "preset" ||
    value.source === "google" ||
    value.source === "query"
      ? value.source
      : "query";
  const type = value.type === "airport" || value.type === "place" ? value.type : null;
  return {
    source,
    name: asString(value.name),
    formattedAddress: asNullableString(value.formattedAddress),
    placeId: asNullableString(value.placeId),
    lat: asNullableNumber(value.lat),
    lng: asNullableNumber(value.lng),
    city: asNullableString(value.city),
    district: asNullableString(value.district),
    region: asNullableString(value.region),
    country: asNullableString(value.country),
    countryCode: asNullableString(value.countryCode),
    airportCode: asNullableString(value.airportCode),
    type,
    placeTypes: asStringArray(value.placeTypes),
  };
}

function validCoordinate(lat: number | null, lng: number | null) {
  if (lat !== null && (lat < -90 || lat > 90)) {
    return false;
  }
  if (lng !== null && (lng < -180 || lng > 180)) {
    return false;
  }
  return true;
}

function parseServiceType(value: unknown): "transfer" | "hourly" | "tour" {
  if (value === HOURLY_SERVICE_TYPE || value === "hourly") {
    return "hourly";
  }
  if (value === TOUR_SERVICE_TYPE || value === "tour") {
    return "tour";
  }
  return "transfer";
}

function parseTourCode(value: unknown): string | null {
  const raw = asNullableString(value);
  return raw as TourId | null;
}

function parseDurationHours(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "invalid";
  }
  const hours = Math.round(value);
  if (hours < HOURLY_MIN_HOURS || hours > HOURLY_MAX_HOURS) {
    return "invalid";
  }
  return hours;
}

export function parseTransferSearchBody(
  body: unknown,
): ParsedTransferSearchInput | TransferSearchInputError {
  if (!isRecord(body)) {
    return { status: 400, message: "Invalid request body" };
  }

  const locale = typeof body.locale === "string" ? body.locale : "";
  if (!isLocale(locale)) {
    return { status: 400, message: "Invalid locale" };
  }

  const serviceType = parseServiceType(body.serviceType);
  const tourCode = parseTourCode(body.tourId ?? body.tourCode);
  const pickup = parseLocation(body.pickup);
  if (!pickup || !isLocationFilled(pickup)) {
    return { status: 400, message: "Pickup is required" };
  }
  if (!validCoordinate(pickup.lat, pickup.lng)) {
    return { status: 400, message: "Invalid coordinates" };
  }

  let localDateTime = asString(body.localDateTime).trim();
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(localDateTime) &&
    tourCode === BOSPHORUS_DINNER_TOUR_CODE
  ) {
    localDateTime = bosphorusLocalDateTimeFromDate(localDateTime);
  }
  const utcMs = istanbulLocalToUtcMs(localDateTime);
  if (!localDateTime || Number.isNaN(utcMs)) {
    return { status: 400, message: "Date and time are required" };
  }

  if (serviceType === "hourly") {
    const durationHours = parseDurationHours(body.durationHours);
    if (durationHours === null || durationHours === "invalid") {
      return { status: 400, message: "Duration is required" };
    }
    return {
      locale,
      serviceType,
      tourCode: null,
      pickup,
      dropoff: emptyLocation(),
      pickupAt: new Date(utcMs),
      distanceKm: null,
      durationHours,
    };
  }

  if (serviceType === "tour") {
    if (!tourCode) {
      return { status: 400, message: "Tour is required" };
    }
    if (tourCode === LAYOVER_TOUR_CODE) {
      if (!layoverAirportCodeFromLocation(pickup)) {
        return { status: 400, message: "Invalid layover pickup airport" };
      }
      return {
        locale,
        serviceType,
        tourCode,
        pickup,
        dropoff: emptyLocation(),
        pickupAt: new Date(utcMs),
        distanceKm: null,
        durationHours: LAYOVER_PACKAGE_HOURS,
      };
    }
    if (tourCode === HALF_DAY_TOUR_CODE || tourCode === FULL_DAY_TOUR_CODE) {
      const durationHours = noKmPackageTourDurationHours(
        serviceType,
        tourCode,
      );
      if (durationHours === null) {
        return { status: 400, message: "Unsupported tour" };
      }
      return {
        locale,
        serviceType,
        tourCode,
        pickup,
        dropoff: emptyLocation(),
        pickupAt: new Date(utcMs),
        distanceKm: null,
        durationHours,
      };
    }
    if (tourCode === SAPANCA_TOUR_CODE || tourCode === BURSA_TOUR_CODE) {
      const durationHours = noKmPackageTourDurationHours(serviceType, tourCode);
      if (durationHours === null) {
        return { status: 400, message: "Unsupported tour" };
      }
      return {
        locale,
        serviceType,
        tourCode,
        pickup,
        dropoff: emptyLocation(),
        pickupAt: new Date(utcMs),
        distanceKm: null,
        durationHours,
      };
    }
    if (tourCode === BOSPHORUS_DINNER_TOUR_CODE) {
      if (!isIstanbulLocationValue(pickup)) {
        return { status: 400, message: "Invalid bosphorus dinner pickup location" };
      }
      return {
        locale,
        serviceType,
        tourCode,
        pickup,
        dropoff: emptyLocation(),
        pickupAt: new Date(utcMs),
        distanceKm: null,
        durationHours: null,
      };
    }
    return { status: 400, message: "Unsupported tour" };
  }

  const dropoff = parseLocation(body.dropoff);
  if (!dropoff || !isLocationFilled(dropoff)) {
    return { status: 400, message: "Pickup and dropoff are required" };
  }
  if (!validCoordinate(dropoff.lat, dropoff.lng)) {
    return { status: 400, message: "Invalid coordinates" };
  }

  const distanceKm = asNullableNumber(body.distanceKm);
  if (distanceKm !== null && distanceKm < 0) {
    return { status: 400, message: "Invalid distance" };
  }

  return {
    locale,
    serviceType: "transfer",
    tourCode: null,
    pickup,
    dropoff,
    pickupAt: new Date(utcMs),
    distanceKm,
    durationHours: null,
  };
}

export async function toTransferSearchFields(input: ParsedTransferSearchInput) {
  return {
    locale: input.locale,
    serviceType: input.serviceType,
    tourCode: input.tourCode,
    pickup: await toPersistedLocation(input.pickup, input.locale),
    dropoff: await toPersistedLocation(input.dropoff, input.locale),
    pickupAt: input.pickupAt,
    distanceKm: input.distanceKm,
    durationHours: input.durationHours,
  };
}
