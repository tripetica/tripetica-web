import { type GpsPresence } from "@/lib/gps/presence";

export type GpsWifiTelemetryKind = "ready" | "pending" | "offline" | "mobile" | "unsupported";

export function wifiHotspotOn(enabled: boolean | null, apStatus: string | null): boolean | null {
  if (enabled === true) return true;
  if (enabled === false) return false;
  if (!apStatus) return null;
  const value = apStatus.trim().toLowerCase();
  if (value === "up" || value === "on" || value === "started" || value === "enabled") return true;
  if (value === "down" || value === "off" || value === "stopped" || value === "disabled") return false;
  return null;
}

export function wifiTelemetryKind(input: {
  presence: GpsPresence;
  manufacturer: "esp32" | "teltonika" | null;
  source?: "device" | "mobile" | null;
  wifiEnabled: boolean | null;
  ssid: string | null;
  clients: number | null;
  apStatus: string | null;
}): GpsWifiTelemetryKind {
  if (input.source === "mobile") return "mobile";
  if (input.manufacturer === "teltonika") return "unsupported";
  if (input.presence === "offline") return "offline";
  if (input.wifiEnabled === null && input.ssid === null && input.clients === null && input.apStatus === null) {
    return "pending";
  }
  return "ready";
}

export const PARTNER_WIFI_LIVE_FIELDS = [
  "rssi",
  "network",
  "lteRegistration",
  "pppStatus",
  "naptStatus",
  "wifiPolicy",
  "apStatus",
  "reportedMaxClients",
] as const;
