export const bookingPath = "/booking";
export const bookingPaymentPath = "/booking/payment";
export const bookingSuccessPath = "/booking/success";

export type BookingStage = "selection" | "checkout";

export type BookingContentKind =
  | "vehicle-selection"
  | "tour-package-selection";

export type BookingSidebarSlot =
  | "serviceType"
  | "pickup"
  | "dropoff"
  | "duration"
  | "dateTime"
  | "tour"
  | "passengers";

export type BookingFlowId =
  | "transfer"
  | "hourly"
  | "sapanca-tour"
  | "bursa-tour"
  | "istanbul-city-tour"
  | "istanbul-layover-tour"
  | "istanbul-half-day-tour"
  | "istanbul-full-day-tour"
  | "bosphorus-dinner-cruise";

export type BookingPageConfig = {
  flowId: BookingFlowId;
  sidebarSlots: readonly BookingSidebarSlot[];
  contentKind: BookingContentKind;
};

export const bookingPageConfigs: Record<BookingFlowId, BookingPageConfig> = {
  transfer: {
    flowId: "transfer",
    sidebarSlots: ["serviceType", "pickup", "dropoff", "dateTime"],
    contentKind: "vehicle-selection",
  },
  hourly: {
    flowId: "hourly",
    sidebarSlots: ["serviceType", "pickup", "duration", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "sapanca-tour": {
    flowId: "sapanca-tour",
    sidebarSlots: ["serviceType", "pickup", "dropoff", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "bursa-tour": {
    flowId: "bursa-tour",
    sidebarSlots: ["serviceType", "pickup", "dropoff", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "istanbul-city-tour": {
    flowId: "istanbul-city-tour",
    sidebarSlots: ["serviceType", "tour", "pickup", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "istanbul-layover-tour": {
    flowId: "istanbul-layover-tour",
    sidebarSlots: ["serviceType", "pickup", "dropoff", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "istanbul-half-day-tour": {
    flowId: "istanbul-half-day-tour",
    sidebarSlots: ["serviceType", "pickup", "dropoff", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "istanbul-full-day-tour": {
    flowId: "istanbul-full-day-tour",
    sidebarSlots: ["serviceType", "pickup", "dropoff", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "bosphorus-dinner-cruise": {
    flowId: "bosphorus-dinner-cruise",
    sidebarSlots: [
      "serviceType",
      "tour",
      "pickup",
      "dropoff",
      "dateTime",
      "passengers",
    ],
    contentKind: "tour-package-selection",
  },
};

export const defaultBookingPageConfig = bookingPageConfigs.transfer;

import { isIstanbulAddressPackageTour } from "@/lib/booking/pricing/istanbul-address-package-tour";
import { isLayoverTour } from "@/lib/booking/pricing/layover-pricing";
import { isBursaTour } from "@/lib/booking/pricing/bursa-pricing";
import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { isSapancaTour } from "@/lib/booking/pricing/sapanca-pricing";

export function bookingPageConfigForDraft(
  serviceType: string | null | undefined,
  tourCode?: string | null,
): BookingPageConfig {
  if (serviceType === "hourly") {
    return bookingPageConfigs.hourly;
  }
  if (isLayoverTour(serviceType, tourCode)) {
    return bookingPageConfigs["istanbul-layover-tour"];
  }
  if (isSapancaTour(serviceType, tourCode)) {
    return bookingPageConfigs["sapanca-tour"];
  }
  if (isBursaTour(serviceType, tourCode)) {
    return bookingPageConfigs["bursa-tour"];
  }
  if (isBosphorusDinnerTour(serviceType, tourCode)) {
    return bookingPageConfigs["bosphorus-dinner-cruise"];
  }
  if (isIstanbulAddressPackageTour(serviceType, tourCode)) {
    if (tourCode === "istanbul-full-day") {
      return bookingPageConfigs["istanbul-full-day-tour"];
    }
    return bookingPageConfigs["istanbul-half-day-tour"];
  }
  return defaultBookingPageConfig;
}
