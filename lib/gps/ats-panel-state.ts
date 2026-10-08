export type GpsAtsPanel = {
  deviceId: string;
  vehicleId: string | null;
  companyName: string | null;
  enabled: boolean;
  sourceDeviceCode: string | null;
  sourceIsThisDevice: boolean;
  blockedReason: "none" | "no_vehicle" | "no_company" | "other_source";
  environment: "test" | "live" | "unavailable";
  lastSuccessAt: string | null;
  lastSentAt: string | null;
  lastResponse: string | null;
  lastError: string | null;
  gpsFresh: boolean;
  activeTrip: boolean;
  waitingForTrip: boolean;
  gpsWarning: boolean;
  warning: boolean;
};
