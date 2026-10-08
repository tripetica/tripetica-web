export const GPS_FIRMWARE_COMMANDS = [
  "reboot",
  "modem_reset",
  "gnss_restart",
  "ppp_reconnect",
  "wifi_on",
  "wifi_off",
  "wifi_auto",
  "set_ssid",
  "set_password",
  "set_telemetry",
  "status",
  "set_max_wifi_clients",
  "wifi_config",
  "low_battery_action",
] as const;

export const GPS_LEGACY_COMMANDS = ["wifi.configure", "wifi.disable"] as const;

export const GPS_PARTNER_COMMANDS = [
  "wifi_on",
  "wifi_off",
  "wifi_auto",
  "set_ssid",
  "set_password",
  "set_max_wifi_clients",
  "wifi_config",
  "reboot",
  "low_battery_action",
] as const;

export const GPS_DESTRUCTIVE_COMMANDS = [
  "reboot",
  "modem_reset",
  "gnss_restart",
  "ppp_reconnect",
] as const;

export type GpsAuditState = "PENDING" | "DELIVERED" | "SUCCESS" | "FAILED" | "EXPIRED" | "CANCELLED";

export function commandAuditState(status: string, error: string | null): GpsAuditState {
  if (status === "queued") return "PENDING";
  if (status === "delivered") return "DELIVERED";
  if (status === "acked") return "SUCCESS";
  if (status === "expired" || error === "timeout") return "EXPIRED";
  if (status === "cancelled") return "CANCELLED";
  return "FAILED";
}

export function isPartnerCommand(kind: string) {
  return (GPS_PARTNER_COMMANDS as readonly string[]).includes(kind);
}

export function isDestructiveCommand(kind: string) {
  return (GPS_DESTRUCTIVE_COMMANDS as readonly string[]).includes(kind);
}

export function wifiConfigPayload(input: {
  mode: "on" | "off" | "auto";
  ssid: string;
  password: string;
  maxClients: number;
}) {
  const payload: Record<string, unknown> = {
    mode: input.mode,
    enabled: input.mode !== "off",
    max_clients: input.maxClients,
  };
  const ssid = input.ssid.trim();
  if (ssid) payload.ssid = ssid;
  if (input.password) payload.password = input.password;
  return payload;
}

export function softwareRebootPayload() {
  return { scope: "software" };
}

export const GPS_WIFI_SHARE_WAIT_MS = 90_000;

export function wifiSharePayload(mode: "on" | "off") {
  return { mode, enabled: mode === "on" };
}

export function wifiShareConfirmKind(
  next: "on" | "off",
  batteryPercent: number | null,
  lowBatteryState: string | null = null,
): "off" | "low" | null {
  if (next === "off") return "off";
  if (batteryPercent !== null && batteryPercent < 20 && lowBatteryState !== "keep_on") return "low";
  return null;
}

export function lowBatteryActionPayload(action: "keep_on" | "save_power") {
  return { action };
}
