import { formatDurationHours } from "@/lib/booking/catalog";
import { isAirportPickup } from "@/lib/booking/occupancy";
import {
  bookingServiceDisplayLabel,
  localizedTourName,
} from "@/lib/booking/tour-display";
import { opsCopy } from "@/lib/ops/copy";
import { formatPassengerLuggageBaby } from "@/lib/ops/process-list-display";
import {
  DRIVER_TASK_ACTION_LABEL,
  type DriverTaskEventSource,
  type DriverTaskProgressStage,
  type DriverTaskStage,
} from "@/lib/ops/driver-task-stages";

export type DriverTaskEventView = {
  stage: DriverTaskProgressStage;
  occurredAt: string;
  eventSource: DriverTaskEventSource;
};

export type DriverTaskContactView = {
  phone: string | null;
  email: string | null;
};

export type DriverTaskPriceView = {
  selectedPrice: string;
  otherCurrencies: string[];
};

export type DriverTaskOpsView = {
  stage: DriverTaskStage;
  openPath: string;
  events: DriverTaskEventView[];
  showPriceInfo: boolean;
  showPassengerContact: boolean;
};

export type DriverTaskPassengerView = {
  sequenceNo: number;
  firstName: string | null;
  lastName: string | null;
  nationality: string | null;
  gender: string | null;
  identityNumber: string | null;
};

export type DriverTaskField = {
  label: string;
  value: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export type DriverTaskPublicView = {
  valid: true;
  stage: DriverTaskStage;
  nextStage: DriverTaskStage | null;
  actionLabel: string | null;
  completed: boolean;
  reservationCode: string;
  fields: DriverTaskField[];
  note: string | null;
  contact: DriverTaskContactView | null;
  price: DriverTaskPriceView | null;
  passengers: DriverTaskPassengerView[];
};

export type DriverTaskPublicResult =
  | DriverTaskPublicView
  | { valid: false; reason: "revoked" | "not-found" };

function pushField(fields: DriverTaskField[], label: string, value: string | null | undefined) {
  const trimmed = value?.trim() || "";
  if (!trimmed) {
    return;
  }
  fields.push({ label, value: trimmed });
}

export function parseDriverTaskCoords(
  latitude: unknown,
  longitude: unknown,
): { latitude: number; longitude: number } | null {
  const lat = typeof latitude === "number" ? latitude : latitude == null || latitude === "" ? NaN : Number(latitude);
  const lng = typeof longitude === "number" ? longitude : longitude == null || longitude === "" ? NaN : Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

export function googleMapsCoordUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function yandexMapsCoordUrl(latitude: number, longitude: number) {
  return `https://yandex.com/maps/?rtext=~${latitude},${longitude}`;
}

function locationAddress(address: string | null | undefined) {
  return address?.trim() || "";
}

function pushLocationField(
  fields: DriverTaskField[],
  label: string,
  name: string | null | undefined,
  address: string | null | undefined,
  latitude: unknown,
  longitude: unknown,
) {
  const trimmedName = name?.trim() || "";
  if (!trimmedName) {
    return;
  }
  const field: DriverTaskField = { label, value: trimmedName };
  const trimmedAddress = locationAddress(address);
  if (trimmedAddress) {
    field.address = trimmedAddress;
  }
  const coords = parseDriverTaskCoords(latitude, longitude);
  if (coords) {
    field.latitude = coords.latitude;
    field.longitude = coords.longitude;
  }
  fields.push(field);
}

export function driverTaskActionLabel(stage: DriverTaskStage) {
  return DRIVER_TASK_ACTION_LABEL[stage];
}

export function buildDriverTaskContact(
  show: boolean,
  phone: string | null | undefined,
  email: string | null | undefined,
): DriverTaskContactView | null {
  if (!show) {
    return null;
  }
  const trimmedPhone = phone?.trim() || null;
  const trimmedEmail = email?.trim() || null;
  if (!trimmedPhone && !trimmedEmail) {
    return null;
  }
  return { phone: trimmedPhone, email: trimmedEmail };
}

export function buildDriverTaskPrice(
  show: boolean,
  display: { selectedPrice: string | null; otherCurrencies: string[] } | null,
): DriverTaskPriceView | null {
  if (!show || !display?.selectedPrice) {
    return null;
  }
  return {
    selectedPrice: display.selectedPrice,
    otherCurrencies: display.otherCurrencies,
  };
}

export function buildDriverTaskPublicFields(input: {
  serviceType: string | null;
  tourCode: string | null;
  pickupAtLabel: string | null;
  pickupName: string | null;
  pickupAddress?: string | null;
  pickupLatitude?: unknown;
  pickupLongitude?: unknown;
  dropoffName: string | null;
  dropoffAddress?: string | null;
  dropoffLatitude?: unknown;
  dropoffLongitude?: unknown;
  pickupAirportCode?: string | null;
  pickupLocationType?: string | null;
  pickupPlaceId?: string | null;
  flightCode: string | null;
  meetAndGreet: boolean | null;
  durationHours: string | null;
  packageCoverage: string | null;
  passengerCount?: number | null;
  luggageCount?: number | null;
  babySeatCount?: number | null;
}): DriverTaskField[] {
  const fields: DriverTaskField[] = [];
  pushField(fields, "Tarih / Saat", input.pickupAtLabel);
  pushField(
    fields,
    "Hizmet Türü",
    bookingServiceDisplayLabel(input.serviceType, input.tourCode, "tr"),
  );
  const service = input.serviceType?.trim();
  if (service === "tour") {
    pushField(fields, "Tur / Paket adı", localizedTourName(input.tourCode, "tr"));
    pushField(fields, "Paket kapsamı", input.packageCoverage);
  }
  if (service === "hourly") {
    const catalogDuration = formatDurationHours(input.durationHours, "tr");
    const rawHours = input.durationHours?.trim() || "";
    const numeric = Number(rawHours);
    pushField(
      fields,
      "Süre",
      catalogDuration ||
        (rawHours && Number.isFinite(numeric) && numeric > 0 ? `${numeric} saat` : rawHours),
    );
  }
  pushLocationField(
    fields,
    "Alış noktası",
    input.pickupName,
    input.pickupAddress,
    input.pickupLatitude,
    input.pickupLongitude,
  );
  if (service === "transfer" || input.dropoffName) {
    pushLocationField(
      fields,
      "Bırakma noktası",
      input.dropoffName,
      input.dropoffAddress,
      input.dropoffLatitude,
      input.dropoffLongitude,
    );
  }
  if (
    isAirportPickup({
      airportCode: input.pickupAirportCode,
      locationType: input.pickupLocationType,
      placeId: input.pickupPlaceId,
    })
  ) {
    pushField(fields, "Uçuş kodu", input.flightCode?.trim() || "Belirtilmedi");
    pushField(
      fields,
      "Karşılama hizmeti",
      input.meetAndGreet === true ? "Evet" : input.meetAndGreet === false ? "Hayır" : "Belirtilmedi",
    );
  }
  pushField(
    fields,
    opsCopy.tr.passengerLuggageBaby,
    formatPassengerLuggageBaby(
      input.passengerCount,
      input.luggageCount,
      input.babySeatCount,
    ),
  );
  return fields;
}
