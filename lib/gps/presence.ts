export const GPS_ONLINE_MS_DEFAULT = 2 * 60 * 1000;
export const GPS_STALE_MS_DEFAULT = 15 * 60 * 1000;

export type GpsPresence = "online" | "stale" | "offline";

export type GpsPresenceThresholds = {
  onlineMs: number;
  staleMs: number;
};

export function gpsPresenceThresholds(
  env: Record<string, string | undefined> = process.env,
): GpsPresenceThresholds {
  const onlineMs = positiveMs(env.GPS_ONLINE_MS, GPS_ONLINE_MS_DEFAULT);
  const staleMs = positiveMs(env.GPS_STALE_MS, GPS_STALE_MS_DEFAULT);
  return {
    onlineMs,
    staleMs: staleMs > onlineMs ? staleMs : onlineMs + 60_000,
  };
}

export function gpsPresence(
  lastHeartbeatAt: string | Date | null,
  now: Date,
  thresholds: GpsPresenceThresholds = gpsPresenceThresholds(),
): GpsPresence {
  if (!lastHeartbeatAt) {
    return "offline";
  }
  const seen = lastHeartbeatAt instanceof Date ? lastHeartbeatAt.getTime() : Date.parse(lastHeartbeatAt);
  if (!Number.isFinite(seen)) {
    return "offline";
  }
  const age = now.getTime() - seen;
  if (age <= thresholds.onlineMs) {
    return "online";
  }
  if (age <= thresholds.staleMs) {
    return "stale";
  }
  return "offline";
}

function positiveMs(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return fallback;
  }
  return parsed;
}
