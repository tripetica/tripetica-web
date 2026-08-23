export const bookingPath = "/booking";

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
    sidebarSlots: ["serviceType", "tour", "pickup", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "bursa-tour": {
    flowId: "bursa-tour",
    sidebarSlots: ["serviceType", "tour", "pickup", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "istanbul-city-tour": {
    flowId: "istanbul-city-tour",
    sidebarSlots: ["serviceType", "tour", "pickup", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "istanbul-layover-tour": {
    flowId: "istanbul-layover-tour",
    sidebarSlots: ["serviceType", "tour", "pickup", "dateTime"],
    contentKind: "vehicle-selection",
  },
  "bosphorus-dinner-cruise": {
    flowId: "bosphorus-dinner-cruise",
    sidebarSlots: ["serviceType", "tour", "passengers"],
    contentKind: "tour-package-selection",
  },
};

export const defaultBookingPageConfig = bookingPageConfigs.transfer;
